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
import json

from flask_appbuilder import expose, has_access
from flask_appbuilder.widgets import ListWidget, RenderTemplateWidget
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from flask import Markup

from superset import app, db, security_manager
from superset.extensions import (
    appbuilder,
)
from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import RouteMethod
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.views.base import check_ownership, DeleteMixin, SupersetModelView
from superset.views.chart.mixin import SliceMixin
from superset.views.chart.filters import SliceFilter, SliceOwnerFilter
from superset.views.dashboard.filters import DashboardFilter
from superset.utils.conform_chart import handle_datasources
from wtforms import BooleanField
from flask_appbuilder.urltools import (
    get_filter_args,
    get_order_args,
    get_page_args,
    get_page_size_args,
    Stack,
)
from flask import (
    abort,
    flash,
    request,
)


class FormWithRemoteOwnerSelectorWidget(RenderTemplateWidget):
    """
        FormWidget

        form = None
        include_cols = []
        exclude_cols = []
        fieldsets = []
    """

    template = "actable-ai/widgets/remote-owner-selector-form.html"


class ChartListWidget(ListWidget):
    template = 'superset/home.html'


class SliceModelView(SliceMixin, SupersetModelView, DeleteMixin):

    edit_widget = FormWithRemoteOwnerSelectorWidget
    route_base = "/chart"
    datamodel = SQLAInterface(Slice)
    include_route_methods = RouteMethod.CRUD_SET | {
        RouteMethod.DOWNLOAD,
        RouteMethod.API_READ,
        RouteMethod.API_DELETE,
    }
    list_widget = ChartListWidget

    list_title = _("Analytics")  # _("Add an analysis")
    show_title = _("Show Analytic")
    add_title = _("Add Analytic")
    edit_title = _("Edit Analytic")

    can_add = False

    search_columns = (
        "slice_name",
        "description",
        "viz_type",
        "datasource_name",
        "owners",
    )

    list_columns = ["slice_link", "viz_name",
                    "datasource_link", "creator", "modified"]
    order_columns = ["viz_name", "datasource_link", "modified"]
    edit_columns = [
        "slice_name",
        "description",
        "viz_type",
        "owners",
        "dashboards",
        "params",
        "cache_timeout",
        "is_example"
    ]
    base_order = ("changed_on", "desc")
    description_columns = {
        "description": Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            '<a href="https://daringfireball.net/projects/markdown/"">'
            "markdown</a>"
        ),
        "params": _(
            "These parameters are generated dynamically when clicking "
            "the save or overwrite button in the explore view. This JSON "
            "object is exposed here for reference and for power users who may "
            "want to alter specific parameters."
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this chart. "
            "Note this defaults to the datasource/table timeout if undefined."
        ),
    }
    base_filters = [["id", SliceFilter, lambda: []]]
    label_columns = {
        "cache_timeout": _("Cache Timeout"),
        "creator": _("Creator"),
        "dashboards": _("Dashboards"),
        "datasource_link": _("Datasource"),
        "description": _("Description"),
        "modified": _("Last Modified"),
        "owners": _("Owners"),
        "params": _("Parameters"),
        "slice_link": _("Analytic"),
        "slice_name": _("Name"),
        "table": _("Table"),
        "viz_name": _("Analysis"),
    }

    add_form_query_rel_fields = {
        "dashboards": [["name", DashboardFilter, None]]}

    edit_form_query_rel_fields = {
        "dashboards": [["name", DashboardFilter, None]]}

    edit_form_extra_fields = {
        "is_example": BooleanField(
            _("Is Example"),
            render_kw ={'checked': False, 'disabled': False },
        ),
    }

    def pre_add(self, obj):
        utils.validate_json(obj.params)

    def pre_update(self, obj):
        utils.validate_json(obj.params)
        check_ownership(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    def _edit(self, pk):
        """
            Edit function logic, override to implement different logic
            returns Edit widget and related list or None
        """
        is_valid_form = True
        pages = get_page_args()
        page_sizes = get_page_size_args()
        orders = get_order_args()
        get_filter_args(self._filters)
        exclude_cols = self._filters.get_relation_cols()

        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            abort(404)
        # convert pk to correct type, if pk is non string type.
        pk = self.datamodel.get_pk_value(item)
        before_item = item
        if request.method == "POST":
            form = self.edit_form.refresh(request.form)
            # fill the form with the suppressed cols, generated from exclude_cols
            self._fill_form_exclude_cols(exclude_cols, form)
            # trick to pass unique validation
            form._id = pk
            if form.validate():
                self.process_form(form, False)

                try:
                    form.populate_obj(item)
                    self.pre_update(item)
                except Exception as e:
                    flash(str(e), "danger")
                else:
                    # Check update item
                    item = self.update_is_example(item, before_item)
                    if self.datamodel.edit(item):
                        self.post_update(item)
                    flash(*self.datamodel.message)
                finally:
                    return None
            else:
                is_valid_form = False
        else:
            # Only force form refresh for select cascade events
            form = self.edit_form.refresh(obj=item)
            
            # Set field example
            form.is_example = self.render_example_checkbox(item, form.is_example)

            # Perform additional actions to pre-fill the edit form.
            self.prefill_form(form, pk)

        widgets = self._get_edit_widget(form=form, exclude_cols=exclude_cols)
        widgets = self._get_related_views_widgets(
            item,
            filters={},
            orders=orders,
            pages=pages,
            page_sizes=page_sizes,
            widgets=widgets,
        )
        if is_valid_form:
            self.update_redirect()
        return widgets
    
    def render_example_checkbox(self, item, is_example):
        if security_manager.is_example_data_of_chart(item.datasource):
            is_example.render_kw['disabled'] = False
        else:
            is_example.render_kw['disabled'] = True
        return is_example
    
    def update_is_example(self, item, before_item):
        if not security_manager.check_role_user('admin'):
            item.is_example = before_item.is_example
        return item


    @expose("/list/", methods=["GET"])
    def list(self):
        env_config = {
            "DATACLEAN_ANALYTICS_FEATURE": app.config.get('DATACLEAN_ANALYTICS_FEATURE'),
            "SENTIMENT_ANALYSIS_FEATURE": app.config.get('SENTIMENT_ANALYSIS_FEATURE'),
            "CLASSIFICATION_ANALYTICS_FEATURE": app.config.get('CLASSIFICATION_ANALYTICS_FEATURE'),
            "REGRESSION_ANALYTICS_FEATURE": app.config.get('REGRESSION_ANALYTICS_FEATURE'),
            "SUNBURST_CHART_FEATURE": app.config.get('SUNBURST_CHART_FEATURE'),
            "SANKEY_DIAGRAM_FEATURE": app.config.get('SANKEY_DIAGRAM_FEATURE'),
            "NIGHTINGALE_ROSE_CHART_FEATURE": app.config.get('NIGHTINGALE_ROSE_CHART_FEATURE'),
            "PARTITION_CHART_FEATURE": app.config.get('PARTITION_CHART_FEATURE'),
            "FORCE_DIRECTED_GRAPH_FEATURE": app.config.get('FORCE_DIRECTED_GRAPH_FEATURE'),
            "CHORD_DIAGRAM_FEATURE": app.config.get('CHORD_DIAGRAM_FEATURE'),
            "DASHBOARD_FEATURE": app.config.get('DASHBOARD_FEATURE'),
            "USECASES_FEATURE": app.config.get('USECASES_FEATURE'),
        }
        appbuilder.data_config = json.dumps(
            {
                "env": env_config
            }
        )
        if not app.config["ENABLE_REACT_CRUD_VIEWS"]:
            widgets = self._list()
            return self.render_template(
                self.list_template,
                title=self.list_title,
                widgets=widgets,
            )

    @expose("/add", methods=["GET", "POST"])
    @has_access
    def add(self):
        return self.render_template(
            "superset/add_slice.html",
        )

class SliceAsync(SliceModelView):
    route_base = "/sliceasync"
    list_columns = [
        "id",
        "slice_link",
        "viz_type",
        "slice_name",
        "creator",
        "modified",
        "icons",
        "params",
        "changed_on_humanized",
    ]
    label_columns = {"icons": " ", "slice_link": _("Chart")}


class SliceAddView(SliceModelView):
    route_base = "/sliceaddview"
    list_columns = [
        "id",
        "slice_name",
        "slice_url",
        "edit_url",
        "viz_type",
        "params",
        "description",
        "description_markeddown",
        "datasource_id",
        "datasource_type",
        "datasource_name_text",
        "datasource_link",
        "owners",
        "modified",
        "changed_on",
        "changed_on_humanized",
    ]
