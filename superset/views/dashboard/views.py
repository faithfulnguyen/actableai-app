# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import re

from flask import g, redirect, request, Response
from flask_appbuilder import expose
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __, lazy_gettext as _

import superset.models.core as models
from superset import app, db, event_logger
from superset.constants import RouteMethod
from superset.utils import core as utils
from superset.views.chart.views import FormWithRemoteOwnerSelectorWidget

from ..base import (
    BaseSupersetView,
    check_ownership,
    DeleteMixin,
    generate_download_headers,
    SupersetModelView,
)
from .mixin import DashboardMixin
from wtforms import BooleanField

class DashboardModelView(
    DashboardMixin, SupersetModelView, DeleteMixin
):  # pylint: disable=too-many-ancestors
    edit_widget = FormWithRemoteOwnerSelectorWidget
    add_widget = FormWithRemoteOwnerSelectorWidget

    route_base = "/dashboard"
    datamodel = SQLAInterface(models.Dashboard)
    # TODO disable api_read and api_delete (used by cypress)
    # once we move to ChartRestModelApi
    include_route_methods = RouteMethod.CRUD_SET | {
        RouteMethod.API_READ,
        RouteMethod.API_DELETE,
        "download_dashboards",
    }

    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "position_json",
        "css",
        "json_metadata",
        "published",
        "is_public",
        "is_example"
    ]

    edit_form_extra_fields = {
        "is_example": BooleanField(
            _("Is Example"),
            render_kw ={'checked': False}
        ),
    }

    @has_access
    @expose("/list/")
    def list(self):
        if not app.config["ENABLE_REACT_CRUD_VIEWS"]:
            return super().list()

        return super().render_app_template()

    @action("mulexport", __("Export"), __("Export dashboards?"), "fa-database")
    def mulexport(self, items):  # pylint: disable=no-self-use
        if not isinstance(items, list):
            items = [items]
        ids = "".join("&id={}".format(d.id) for d in items)
        return redirect("/dashboard/export_dashboards_form?{}".format(ids[1:]))

    @event_logger.log_this
    @has_access
    @expose("/export_dashboards_form")
    def download_dashboards(self):
        if request.args.get("action") == "go":
            ids = request.args.getlist("id")
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers("json"),
                mimetype="application/text",
            )
        return self.render_template(
            "superset/export_dashboards.html", dashboards_url="/dashboard/list"
        )

    def pre_add(self, item):
        item.slug = item.slug or None
        if item.slug:
            item.slug = item.slug.strip()
            item.slug = item.slug.replace(" ", "-")
            item.slug = re.sub(r"[^\w\-]+", "", item.slug)
        if g.user not in item.owners:
            item.owners.append(g.user)
        utils.validate_json(item.json_metadata)
        utils.validate_json(item.position_json)
        owners = [o for o in item.owners]
        for slc in item.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def pre_update(self, item):
        check_ownership(item)
        self.pre_add(item)

    

class Dashboard(BaseSupersetView):
    """The base views for Superset!"""

    @has_access
    @expose("/new/")
    def new(self):  # pylint: disable=no-self-use
        """Creates a new, blank dashboard and redirects to it in edit mode"""
        new_dashboard = models.Dashboard(
            dashboard_title="[ untitled dashboard ]", owners=[g.user]
        )
        db.session.add(new_dashboard)
        db.session.commit()
        return redirect(f"/superset/dashboard/{new_dashboard.id}/?edit=true")


class DashboardModelViewAsync(DashboardModelView):  # pylint: disable=too-many-ancestors
    route_base = "/dashboardasync"
    include_route_methods = {RouteMethod.API_READ}

    list_columns = [
        "id",
        "dashboard_link",
        "creator",
        "modified",
        "dashboard_title",
        "changed_on",
        "url",
        "changed_by_name",
    ]
    label_columns = {
        "dashboard_link": _("Dashboard"),
        "dashboard_title": _("Title"),
        "creator": _("Creator"),
        "modified": _("Modified"),
    }
