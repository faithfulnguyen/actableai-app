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
import logging

from flask import g, make_response, request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext

from superset.constants import RouteMethod
from superset.dashboards.commands.bulk_delete import BulkDeleteDashboardCommand
from superset.dashboards.commands.create import CreateDashboardCommand
from superset.dashboards.commands.delete import DeleteDashboardCommand
from superset.dashboards.commands.exceptions import (
    DashboardBulkDeleteFailedError,
    DashboardCreateFailedError,
    DashboardDeleteFailedError,
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.dashboards.commands.update import UpdateDashboardCommand
from superset.dashboards.filters import DashboardFilter
from superset.dashboards.schemas import (
    CloneSchema,
    DashboardPostSchema,
    DashboardPutSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
)
from superset.models.dashboard import Dashboard
from superset.views.base import generate_download_headers
from superset.views.base_api import BaseSupersetModelRestApi
from flask_appbuilder.api.schemas import get_list_schema
from superset import db, app
import pandas as pd
from marshmallow.validate import ValidationError

logger = logging.getLogger(__name__)


class DashboardRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dashboard)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "DashboardModelView"
    show_columns = [
        "id",
        "charts",
        "css",
        "dashboard_title",
        "json_metadata",
        "owners.id",
        "owners.username",
        "changed_by_name",
        "changed_by_url",
        "changed_by.username",
        "changed_on",
        "position_json",
        "published",
        "url",
        "slug",
        "table_names",
    ]
    order_columns = [
      "dashboard_title", 
      "changed_on", 
      "published", 
      "changed_by_fk",
      "changed_by_name",
      "created_by_name",
      "created_on",
      "is_public"
    ]
    list_columns = [
        "changed_by_name",
        "changed_by_url",
        "changed_by.username",
        "changed_on",
        "dashboard_title",
        "id",
        "published",
        "slug",
        "url",
        "is_public",
        "can_edit",
        "can_delete",
        "created_by_fk",
        "created_on",
        "created_by_name",
        "created_by_url",
        "is_example"
    ]
    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    search_columns = ("dashboard_title", "slug", "owners", "published")
    add_columns = edit_columns
    base_order = ("changed_on", "desc")

    add_model_schema = DashboardPostSchema()
    edit_model_schema = DashboardPutSchema()

    base_filters = [["slice", DashboardFilter, lambda: []]]

    openapi_spec_tag = "Dashboards"
    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    filter_rel_fields_field = {"owners": "first_name"}
    allowed_rel_fields = {"owners"}

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self) -> Response:
        """Creates a new Dashboard
        ---
        post:
          description: >-
            Create a new Dashboard
          requestBody:
            description: Dashboard schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dashboard added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=err.messages)
        try:
            new_model = CreateDashboardCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except DashboardInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except DashboardCreateFailedError as e:
            logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Dashboard
        ---
        put:
          description: >-
            Changes a Dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Dashboard schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Dashboard changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        # marshmallow 3.x change https://marshmallow.readthedocs.io/en/stable/upgrading.html#deserializing-invalid-types-raises-a-validationerror
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=err.messages)
        try:
            changed_model = UpdateDashboardCommand(g.user, pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except DashboardUpdateFailedError as e:
            logger.error(f"Error updating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Dashboard
        ---
        delete:
          description: >-
            Deletes a Dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dashboard deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteDashboardCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardDeleteFailedError as e:
            logger.error(f"Error deleting model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs) -> Response:  # pylint: disable=arguments-differ
        """Delete bulk Dashboards
        ---
        delete:
          description: >-
            Deletes multiple Dashboards in a bulk operation
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Dashboard bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteDashboardCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    f"Deleted %(num)d dashboard",
                    f"Deleted %(num)d dashboards",
                    num=len(item_ids),
                ),
            )
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardBulkDeleteFailedError as e:
            return self.response_422(message=str(e))

    @expose("/export/", methods=["GET"])
    @protect()
    @safe
    @rison(get_export_ids_schema)
    def export(self, **kwargs):
        """Export dashboards
        ---
        get:
          description: >-
            Exports multiple Dashboards and downloads them as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Dashboard export
              content:
                text/plain:
                  schema:
                    type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        query = self.datamodel.session.query(Dashboard).filter(
            Dashboard.id.in_(kwargs["rison"])
        )
        query = self._base_filters.apply_all(query)
        ids = [item.id for item in query.all()]
        if not ids:
            return self.response_404()
        export = Dashboard.export_dashboards(ids)
        resp = make_response(export, 200)
        resp.headers["Content-Disposition"] = generate_download_headers("json")[
            "Content-Disposition"
        ]
        return resp
    @expose("/", methods=["GET"])
    @safe
    @rison(get_list_schema)
    def get_list(self, **kwargs):
        """Get list of items from Model
        ---
        get:
          description: >-
            Get a list of models
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Items from Model
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      label_columns:
                        type: object
                        properties:
                          column_name:
                            description: >-
                              The label for the column name.
                              Will be translated by babel
                            example: A Nice label for the column
                            type: string
                      list_columns:
                        description: >-
                          A list of columns
                        type: array
                        items:
                          type: string
                      description_columns:
                        type: object
                        properties:
                          column_name:
                            description: >-
                              The description for the column name.
                              Will be translated by babel
                            example: A Nice description for the column
                            type: string
                      list_title:
                        description: >-
                          A title to render.
                          Will be translated by babel
                        example: List Items
                        type: string
                      ids:
                        description: >-
                          A list of item ids, useful when you don't know the column id
                        type: array
                        items:
                          type: string
                      count:
                        description: >-
                          The total record count on the backend
                        type: number
                      order_columns:
                        description: >-
                          A list of allowed columns to sort
                        type: array
                        items:
                          type: string
                      result:
                        description: >-
                          The result from the get list query
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'  # noqa
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        from flask_appbuilder.const import API_RESULT_RES_KEY
        from flask_appbuilder.exceptions import InvalidOrderByColumnFABException
        _response = dict()
        _args = kwargs.get("rison", {})

       
        _list_model_schema = self.list_model_schema
        # handle base order
        try:
            order_column, order_direction = self._handle_order_args(_args)
        except InvalidOrderByColumnFABException as e:
            return self.response_400(message=str(e))
        # handle pagination
        page_index, page_size = self._handle_page_args(_args)
        # Make the query
        from sqlalchemy import and_, or_
        from superset.models.slice import Slice
        from flask_appbuilder.security.sqla.models import User
        from sqlalchemy.orm import aliased
        from sqlalchemy.sql.functions import func
        changed_user = aliased(User)
        created_user = aliased(User)
        keyword = _args.get('keyword', None)
        query = (
          self.datamodel.session.query(Dashboard)
          .join(changed_user,Dashboard.changed_by_fk==changed_user.id, isouter=True)
          .join(created_user, Dashboard.created_by_fk==created_user.id, isouter=True)
        )
        if keyword: 
          
          query = query.filter(
             or_(
               Dashboard.dashboard_title.ilike('%'+keyword+'%'),
               Dashboard.description.ilike('%'+keyword+'%'),
               Dashboard.created_by.has(User.username.ilike('%'+keyword+'%')),
               Dashboard.created_by.has(User.first_name.ilike('%'+keyword+'%')),
               Dashboard.created_by.has(User.last_name.ilike('%'+keyword+'%')),
               Dashboard.slices.any(Slice.slice_name.ilike('%'+keyword+'%'))
            )
          )
        query = self._base_filters.apply_all(query)
        query = query.with_entities(
          Dashboard, 
          func.concat(changed_user.first_name, changed_user.last_name).label('changed_by_name'),
          func.concat(created_user.first_name, created_user.last_name).label('created_by_name'),
          Dashboard.changed_on.label('changed_on'),
          Dashboard.created_on.label('created_on')
        )
        if order_column and order_direction:
          from sqlalchemy.sql import text
          order_values = '{0} {1}'.format(order_column, order_direction) 
          query= query.order_by(text(order_values))
        items = query.paginate(page=page_index+1, per_page = page_size)
        count = items.total
        lst = [ x[0] for x in items.items]
        
        pks = self.datamodel.get_keys(lst)
        _response[API_RESULT_RES_KEY] = _list_model_schema.dump(lst, many=True)
        _response["ids"] = pks
        _response["count"] = count
        self.pre_get_list(_response)
        return self.response(200, **_response)
    
    @protect()
    @safe
    @expose("/clone", methods=["POST"])
    def clone(self) -> Response:
      try:
        request_data = request.form
        schema = CloneSchema()
        try:
            _ = schema.load(request_data)
        except ValidationError as err:
            return self.response_400(message=err.messages)
          
        dashboard_title = request_data.get('name')
        dashboard_id = request_data.get('id')
        cloned_dashboard = db.session.query(Dashboard).get(dashboard_id)
        if cloned_dashboard is not None:
          new_dashboard = cloned_dashboard.copy()
          new_dashboard.dashboard_title = dashboard_title
          new_dashboard.id = None
          Dashboard.import_obj(new_dashboard)
          db.session.commit()
        else:
          return self.response_404()
        return self.response(200, message='Clone dashboard success')
      except Exception as e:
        db.session.rollback()
        return self.response_400(message=str(e))
