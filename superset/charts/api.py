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
import logging
import pandas as pd
from typing import Any
from marshmallow import ValidationError

from flask import g, request, Response, flash, redirect
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.api.schemas import get_list_schema
from flask_babel import ngettext

from superset.charts.commands.bulk_delete import BulkDeleteChartCommand
from superset.charts.commands.create import CreateChartCommand
from superset.charts.commands.delete import DeleteChartCommand
from superset.charts.commands.exceptions import (
    ChartBulkDeleteFailedError,
    ChartCreateFailedError,
    ChartDeleteFailedError,
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.charts.commands.update import UpdateChartCommand
from superset.charts.filters import ChartFilter
from superset.charts.schemas import (
    ChartPostSchema,
    ChartPutSchema,
    get_delete_ids_schema,
)
from superset import db, security_manager, app
from superset.constants import RouteMethod
from superset.connectors.connector_registry import ConnectorRegistry
from superset.views.chart.filters import SliceFilter
from superset.views.base import CsvResponse, generate_download_headers
from superset.views.utils import get_viz
from superset.views.base_api import BaseSupersetModelRestApi
from superset.models.slice import Slice
from superset.utils.conform_chart import handle_datasources
from superset.dashboards.schemas import CloneSchema

logger = logging.getLogger(__name__)


class ChartRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "chart"
    allow_browser_login = True

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined,
        "download",
        "check_result",
        "clone_chart",
        "list_datasource"

    }
    class_permission_name = "SliceModelView"
    show_columns = [
        "slice_name",
        "description",
        "owners.id",
        "owners.username",
        "dashboards.id",
        "dashboards.dashboard_title",
        "viz_type",
        "params",
        "cache_timeout",
        "can_edit",
        "can_delete",
        "created_by_fk",
        "created_on"
    ]
    list_columns = [
        "id",
        "slice_name",
        "url",
        "description",
        "changed_by.username",
        "changed_by_name",
        "changed_by_url",
        "changed_on",
        "datasource_name_text",
        "datasource_url",
        "viz_type",
        "params",
        "cache_timeout",
        "can_edit",
        "can_delete",
        "created_by_fk",
        "created_on",
        "created_by_name",
        "created_by_url",
        "is_example"
    ]
    order_columns = [
        "slice_name",
        "viz_type",
        "datasource_name",
        "changed_by_fk",
        "changed_on",
        "changed_by_name",
        "created_by_name",
        "datasource_name_text",
        "created_on"
    ]
    search_columns = (
        "slice_name",
        "description",
        "viz_type",
        "datasource_name",
        "owners",
    )
    base_order = ("changed_on", "desc")
    base_filters = [["id", SliceFilter, lambda: []]]

    # Will just affect _info endpoint
    edit_columns = ["slice_name"]
    add_columns = edit_columns

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    openapi_spec_tag = "Charts"

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
        """Creates a new Chart
        ---
        post:
          description: >-
            Create a new Chart
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Chart added
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
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if 'errors' in item:
            return self.response_400(message=item['errors'])
        try:
            new_model = CreateChartCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except ChartInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except ChartCreateFailedError as e:
            logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Chart
        ---
        put:
          description: >-
            Changes a Chart
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Chart changed
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
          
        try:
          item = self.edit_model_schema.load(request.json)
        except ValidationError as err:
          return self.response_400(message=err.messages)
          
        if 'errors' in item:
            return self.response_400(message=item['errors'])
        try:
            changed_model = UpdateChartCommand(g.user, pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except ChartUpdateFailedError as e:
            logger.error(f"Error updating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Chart
        ---
        delete:
          description: >-
            Deletes a Chart
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Chart delete
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
            DeleteChartCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartDeleteFailedError as e:
            logger.error(f"Error deleting model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @rison(get_delete_ids_schema)
    def bulk_delete(
        self, **kwargs: Any
    ) -> Response:  # pylint: disable=arguments-differ
        """Delete bulk Charts
        ---
        delete:
          description: >-
            Deletes multiple Charts in a bulk operation
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
              description: Charts bulk delete
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
            BulkDeleteChartCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    f"Deleted %(num)d chart",
                    f"Deleted %(num)d charts",
                    num=len(item_ids),
                ),
            )
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartBulkDeleteFailedError as e:
            return self.response_422(message=str(e))
    
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
        from flask_appbuilder.security.sqla.models import User
        from sqlalchemy.orm import aliased
        from sqlalchemy.sql.functions import func
        changed_user = aliased(User)
        created_user = aliased(User)
        keyword = _args.get('keyword', None)
        query = (
          self.datamodel.session.query(Slice)
          .join(changed_user,Slice.changed_by_fk==changed_user.id, isouter=True)
          .join(created_user, Slice.created_by_fk==created_user.id, isouter=True)
        )
        if keyword: 
          
          query = query.filter(
             or_(
               Slice.slice_name.ilike('%'+keyword+'%'),
               Slice.datasource_name.ilike('%'+keyword+'%'),
               Slice.created_by.has(User.username.ilike('%'+keyword+'%')),
               Slice.created_by.has(User.first_name.ilike('%'+keyword+'%')),
               Slice.created_by.has(User.last_name.ilike('%'+keyword+'%')),
            )
          )
        query = self._base_filters.apply_all(query)
        query = query.with_entities(Slice, 
                                    func.concat(changed_user.first_name, changed_user.last_name).label('changed_by_name'),
                                    func.concat(created_user.first_name, created_user.last_name).label('created_by_name'),
                                    Slice.datasource_name.label('datasource_name_text'),
                                    Slice.changed_on.label('changed_on'),
                                    Slice.created_on.label('created_on')
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
    
    @expose("/list-datasource", methods=["GET"])
    @protect()
    @safe
    def list_datasource(self) -> Response:
      query = ConnectorRegistry.get_all_datasources(db.session)
      datasources = []
      if security_manager.can_access_all_datasources():
        datasources = query
      else:
        for datasource in query:
          if (
            security_manager.can_access("datasource_access", datasource.perm)
            or security_manager.datasource_access_owned(datasource)
          ):
            datasources.append(datasource)
      datasources = handle_datasources(datasources)
      datasources = sorted(datasources, key=lambda d: d["label"])
      return json.dumps(datasources) 

    @protect()
    @safe
    @expose("/clone", methods=["POST"])
    def clone_chart(self) -> Response:
      try:
        request_data = request.form
        schema = CloneSchema()
        try:
            _ = schema.load(request_data)
        except ValidationError as err:
            return self.response_400(message=err.messages)
          
        import superset.models.core as models
        slice_name = request_data.get('name')
        slice_id = request_data.get('id')
        cloned_slice = db.session.query(Slice).get(slice_id)
        if cloned_slice is not None:
          slice = cloned_slice.clone()
          slice.slice_name = slice_name
          slice.user_id = g.user.id
          slice.owners = [g.user]
          db.session.add(slice)
          db.session.commit()
        else:
          return self.response_404()
        return self.response(200, message='Clone slice success')
      except Exception as e:
        db.session.rollback()
        return self.response_400(message=str(e))

    @expose("/download/<pk>", methods=["GET"])
    @protect()
    @safe
    def download(self, pk: int):
      data = self.get_result(pk)
      if data is None or len(data) <= 3:
        return self.response_400(message="Empty data")
      return CsvResponse(
          data,
          status=200,
          headers=generate_download_headers("csv"),
          mimetype="application/csv",
      )

    @expose("/check-result/<pk>", methods=["GET"])
    @protect()
    @safe
    def check_result(self, pk: int):
      data = self.get_result(pk)
      return json.dumps({
        "result": data is not None and len(data) > 3
      })
    
    def get_result(self, pk: int):
      query = db.session.query(Slice).filter_by(id=pk)
      item  = query.one_or_none()
      if item is None:
        return None

      viz_obj = get_viz(
        datasource_type=item.datasource_type,
        datasource_id=item.datasource_id,
        form_data=item.form_data,
        force=False,
      )
      if "taskId" in viz_obj.form_data and viz_obj.form_data["taskId"] is not None:
        data = viz_obj.get_csv_custom()
      else:
        data = viz_obj.get_csv()

      return data
