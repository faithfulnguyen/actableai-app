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
import os
import pandas as pd

from marshmallow import ValidationError
from superset.exceptions import SupersetErrorException, SupersetException
from superset.db_engine_specs.base import BaseEngineSpec
from wtforms.validators import ValidationError
from superset.dashboards.schemas import CloneSchema

import tempfile
import uuid

import yaml
from flask import g, request, Response
from flask_appbuilder.api import BaseApi, expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.utils import core as utils
import superset.models.core as models
from superset import app, db
from superset.connectors.sqla.models import SqlaTable
from superset.constants import RouteMethod
from superset.datasets.commands.create import CreateDatasetCommand
from superset.datasets.commands.delete import DeleteDatasetCommand
from superset.datasets.commands.exceptions import (
    DatasetCreateFailedError,
    DatasetDeleteFailedError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    DatasetRefreshFailedError,
    DatasetUpdateFailedError,
    DatasetBulkDeleteFailedError
)

from superset.datasets.commands.refresh import RefreshDatasetCommand
from superset.datasets.commands.update import UpdateDatasetCommand
from superset.datasets.schemas import (
    DatasetPostSchema,
    DatasetPutSchema,
    get_export_ids_schema,
    get_delete_ids_schema
)
from superset.views.base import DatasourceFilter, generate_download_headers
from superset.views.base_api import BaseSupersetModelRestApi
from superset.views.database.filters import DatabaseFilter
from superset import security_manager
from superset.datasets.commands.bulk_delete import BulkDeleteDatasetCommand
from flask_babel import ngettext
from flask_appbuilder.api.schemas import get_list_schema
logger = logging.getLogger(__name__)


class DatasetRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SqlaTable)
    base_filters = [["id", DatasourceFilter, lambda: []]]

    resource_name = "dataset"
    allow_browser_login = True

    class_permission_name = "TableModelView"
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        "bulk_delete",
        "refresh",
        "upload_csv",
        "clone",
        "download"
    }
    list_columns = [
        "database_name",
        "changed_by_name",
        "description",
        "changed_by_url",
        "changed_by.username",
        "changed_on",
        "database_name",
        "explore_url",
        "id",
        "schema",
        "table_name",
        "can_edit",
        "can_delete",
        "created_by_fk",
        "created_on",
        "created_by_name",
        "created_by_url",
        "is_example",
        "is_public"
    ]
    show_columns = [
        "database.database_name",
        "database.id",
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners.id",
        "owners.username",
        "owners.email",
        "columns",
        "metrics",
    ]
    add_model_schema = DatasetPostSchema()
    edit_model_schema = DatasetPutSchema()
    add_columns = ["database", "schema", "table_name", "owners"]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "schema",
        "description",
        "main_dttm_col",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "owners",
        "columns",
        "metrics",
    ]
    
    base_order = ("changed_on", "desc")

    openapi_spec_tag = "Datasets"

    filter_rel_fields_field = {"owners": "first_name", "database": "database_name"}
    filter_rel_fields = {"database": [["id", DatabaseFilter, lambda: []]]}
    allowed_rel_fields = {"database", "owners"}
    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self) -> Response:
        """Creates a new Dataset
        ---
        post:
          description: >-
            Create a new Dataset
          requestBody:
            description: Dataset schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dataset added
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
            new_model = CreateDatasetCommand(g.user, item.data).run()
            return self.response(201, id=new_model.id, result=item.data)
        except DatasetInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except DatasetCreateFailedError as e:
            logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Dataset
        ---
        put:
          description: >-
            Changes a Dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Dataset schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Dataset changed
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
          
        # This validates custom Schema with custom validations
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=err.messages)
          
        try:
            changed_model = UpdateDatasetCommand(g.user, pk, item).run()
            return self.response(200, id=changed_model.id, result=item)
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except DatasetUpdateFailedError as e:
            logger.error(f"Error updating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Dataset
        ---
        delete:
          description: >-
            Deletes a Dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dataset delete
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

            DeleteDatasetCommand(g.user, pk).run()

            return self.response(200, message="OK")
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetDeleteFailedError as e:
            logger.error(f"Error deleting model {self.__class__.__name__}: {e}")
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
            Exports multiple datasets and downloads them as YAML files
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
              description: Dataset export
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
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        query = self.datamodel.session.query(SqlaTable).filter(
            SqlaTable.id.in_(requested_ids)
        )
        query = self._base_filters.apply_all(query)
        items = query.all()
        ids = [item.id for item in items]
        if len(ids) != len(requested_ids):
            return self.response_404()

        data = [t.export_to_dict() for t in items]
        return Response(
            yaml.safe_dump(data),
            headers=generate_download_headers("yaml"),
            mimetype="application/text",
        )

    @expose("/<pk>/refresh", methods=["PUT"])
    @protect()
    @safe
    def refresh(self, pk: int) -> Response:  # pylint: disable=invalid-name
        """Refresh a Dataset
        ---
        put:
          description: >-
            Refreshes and updates columns of a dataset
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dataset delete
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
            RefreshDatasetCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetRefreshFailedError as e:
            logger.error(f"Error refreshing dataset {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @protect()
    @safe
    @expose("/upload_csv", methods=["POST"])
    def upload_csv(self) -> Response:
      # API for appsheet upload without schema param
      
      if security_manager.is_beta_user():
        from superset.models.custom import Workspace
        try:
            workspace = Workspace.get_or_create_workspace(g.user)
        except SupersetException as se:
            return self.response_400(str(se))
        except Exception as e:
            return self.response_400(str(e))
        database = db.session.query(models.Database).get(workspace.db_id)
        temp_upload_csv_schema = str(workspace.name)
      else:
        temp_upload_csv_db = app.config["APPSHEET_TEMP_UPLOAD_CSV_DB"] or "actableai"
        temp_upload_csv_schema = app.config["APPSHEET_TEMP_UPLOAD_CSV_SCHEMA"] or "public"

        database = (
          db.session.query(models.Database).filter_by(database_name=temp_upload_csv_db).one_or_none()
        )

      if not database:
        logger.exception("Not found temp database for upload. \
          Please config correct APPSHEET_TEMP_UPLOAD_CSV_DB and APPSHEET_TEMP_UPLOAD_CSV_SCHEMA.")

      csv_file = request.files['csv_file']
      csv_filename = csv_file.filename
      extension = os.path.splitext(csv_filename)[1].lower()
      path = tempfile.NamedTemporaryFile(
          dir=app.config["UPLOAD_FOLDER"], suffix=extension, delete=False
      ).name
      csv_file.filename = path

      try:
          utils.ensure_path_exists(app.config["UPLOAD_FOLDER"])
          csv_file.save(path)
          table_name = str(uuid.uuid4())
          csv_to_df_kwargs = {
            "sep": ',',
            "header": 0,
            "mangle_dupe_cols": True,
            "skipinitialspace": False,
            "skiprows": 0,
            "skip_blank_lines": True,
            "infer_datetime_format": True,
            "chunksize": 10000,
            "thousands": ",",
          }
          df_to_sql_kwargs = {
            "name": table_name,
            "if_exists": "fail",
            "chunksize": 10000,
            "index": False,
          }
          create_table_result = database.db_engine_spec.create_table_from_csv_without_form(path, temp_upload_csv_schema, database, csv_to_df_kwargs, df_to_sql_kwargs)
          table = (
              db.session.query(SqlaTable)
                  .filter_by(
                  table_name=table_name,
                  schema=temp_upload_csv_schema,
                  database_id=database.id,
              ).one_or_none()
          )
          if table:
              table.fetch_metadata()
          if not table:
              table = SqlaTable(table_name=table_name)
              table.database = database
              table.database_id = database.id
              table.user_id = not g.user.is_anonymous and g.user.id
              table.schema = temp_upload_csv_schema
              table.is_uploaded = True
              table.fetch_metadata()
              db.session.add(table)
          db.session.commit()
      except Exception as e:  # pylint: disable=broad-except
          db.session.rollback()
          try:
              os.remove(path)
          except OSError:
              pass
          message = _(
              'Unable to upload CSV file "%(filename)s" to table '
              '"%(table_name)s" in database "%(db_name)s". '
              "Error message: %(error_msg)s",
              filename=csv_filename,
              table_name=table_name,
              db_name=database.database_name,
              error_msg=str(e),
          )
          return json.dumps({"error": str(message)})

      os.remove(path)
      message = _(
          'CSV file "%(csv_filename)s" uploaded to table "%(table_name)s" in '
          'database "%(db_name)s".' + create_table_result.get('warning_message', ""),
          csv_filename=csv_filename,
          table_name=table_name,
          db_name=table.database.database_name,
      )

      return self.response(200, message=str(message), table_id=table.id)

    @expose("/api/google/<link>", methods=["POST"])
    def google(self, link):
        if not g.user.is_anonymous:
            return redirect("/")

        callback_url = app.config.get("SUPERSET_DOMAIN") \
                      + "/api/oauth/google/authorized/" + link
        return google.authorize(callback=callback_url)

    @expose("/api/google/authorized/<link>")
    def google_authorized(self, link):
        resp = google.authorized_response()
        if resp is None:
            flash("Incorrect format", "error")
            return redirect("/login")

        session['google_token'] = (resp['access_token'], '')
        me = google.get('userinfo')
        email = me.data["email"]
        m = re.match(r"(.+)@.+", email)
        username = m.group(1)
        user = db.session.query(ab_models.User).filter(or_(ab_models.User.email == email,
                                                          ab_models.User.username == username)).first()
        if user is None:
            role_beta = security_manager.find_role("Beta")
            if 'family_name' in me.data:
                user = security_manager.add_user(
                    username, me.data["given_name"], me.data["family_name"],
                    me.data["email"], role_beta, str(uuid.uuid4())[:8]
                )
            else:
                user = security_manager.add_user(
                    username, me.data["given_name"], me.data["given_name"],
                    me.data["email"], role_beta, str(uuid.uuid4())[:8]
                )
        if user.login_count is None:
            user.login_count = 0
        user.login_count += 1
        user.last_login = datetime.datetime.now()
        db.session.commit()
        if not link:
            return self.response_400(message="Request is not Input Link")
        body = {
            "allow_csv_upload": true,
            "allow_ctas": true,
            "allow_cvas": true,
            "allow_dml": true,
            "allow_multi_schema_metadata_fetch": true,
            "allow_run_async": true,
            "cache_timeout": 0,
            "database_name": "Google sheet",
            "encrypted_extra": "string",
            "expose_in_sqllab": true,
            "extra": "string",
            "force_ctas_schema": "string",
            "impersonate_user": true,
            "server_cert": "string",
            "sqlalchemy_uri": "gsheetsdb://" + link
        }
        jsonData = json.dumps(body)
        
        # This validates custom Schema with custom validations
        try:
            item = self.add_model_schema.load(jsonData)
        except ValidationError as err:
            return self.response_400(message=err.messages)
          
        try:
            new_model = CreateDatasetCommand(g.user, item.data).run()
            return self.response(201, id=new_model.id, result=item.data)
        except DatasetInvalidError as e:
            return self.response_422(message=e.normalized_messages())
        except DatasetCreateFailedError as e:
            logger.error(f"Error creating model {self.__class__.__name__}: {e}")
            return self.response_422(message=str(e))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs) -> Response:
        """Delete bulk Datasets
        ---
        delete:
          description: >-
            Deletes multiple Datasets in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Dataset bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
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
        item_ids = kwargs["rison"]
        try:
            BulkDeleteDatasetCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d dataset",
                    "Deleted %(num)d datasets",
                    num=len(item_ids),
                ),
            )
        except DatasetNotFoundError:
            return self.response_404()
        except DatasetForbiddenError:
            return self.response_403()
        except DatasetBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))
        except SupersetErrorException  as ex:
            return self.response_400(message=str(ex))
        except SupersetException  as ex:
            return self.response_400(message=str(ex))
        except Exception  as ex:
            return self.response_400(message=str(ex))

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
        keyword = _args.get('keyword', None)
        from flask_appbuilder.security.sqla.models import User
        from sqlalchemy.orm import aliased
        from sqlalchemy import and_, or_
        from superset.models.slice import Slice
        from superset.models.core import Database
        from sqlalchemy.sql.functions import func
        changed_user = aliased(User)
        created_user = aliased(User)
        query = (
          self.datamodel.session.query(SqlaTable)
          .join(changed_user,SqlaTable.changed_by_fk==changed_user.id, isouter=True)
          .join(created_user, SqlaTable.created_by_fk==created_user.id, isouter=True)
          .join(Database, SqlaTable.database_id == Database.id, isouter=True)
        )

        if keyword:
          query = query.filter(
             or_(
               SqlaTable.table_name.ilike('%'+keyword+'%'),
               SqlaTable.database.has(Database.database_name.ilike('%'+keyword+'%')),
               SqlaTable.created_by.has(User.username.ilike('%'+keyword+'%')),
               SqlaTable.created_by.has(User.first_name.ilike('%'+keyword+'%')),
               SqlaTable.created_by.has(User.last_name.ilike('%'+keyword+'%')),
               SqlaTable.slices.any(Slice.slice_name.ilike('%'+keyword+'%'))
            )
          )
        query = self._base_filters.apply_all(query)
        if order_column and order_direction:
          from sqlalchemy.sql import text
          order_values = '{0} {1}'.format(order_column, order_direction)
          query= query.order_by(text(order_values))
        query = query.with_entities(SqlaTable,
                                    func.concat(changed_user.first_name, changed_user.last_name).label('changed_by_name'),
                                    func.concat(created_user.first_name, created_user.last_name).label('created_by_name'),
                                    Database.database_name.label('database_name'),
                                    SqlaTable.default_endpoint.label('explore_url'),
                                    SqlaTable.changed_on.label('changed_on'),
                                    SqlaTable.created_on.label('created_on')
                                    )
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

        # This validates custom Schema with custom validations
        try:
            data = schema.load(request_data)
        except ValidationError as err:
            return self.response_400(message=err.messages)

        temp_schema = 'public'
        if security_manager.is_beta_user():
          from superset.models.custom import Workspace
          workspace = Workspace.get_or_create_workspace(g.user)
          database = db.session.query(models.Database).get(workspace.db_id)
          temp_schema = str(workspace.name)
        table_name = request_data.get('name')
        table_id = request_data.get('id')
        # Check table exist 
        table = (
          db.session.query(SqlaTable)
              .filter_by(
              table_name=table_name,
              schema=temp_schema,
              database_id=database.id,
          ).one_or_none()
        )

        if table:
          return self.response_400(message="Table name is exist")
        cloned_table = db.session.query(SqlaTable).get(table_id)
        if cloned_table is not None:
          BaseEngineSpec.clone_table(database, cloned_table.schema, cloned_table.table_name, temp_schema, table_name)
          new_table = cloned_table.copy()
          new_table.id = None
          new_table.table_name = table_name
          new_table.database = database
          new_table.schema = temp_schema
          new_table.fetch_metadata()
          db.session.add(new_table)
          db.session.commit()
          return self.response(200, message='Clone dataset success')
        else:
            return self.response_404()
      except Exception as e:
        db.session.rollback()
        return self.response_400(message=str(e))
    
    @expose("/download/<pk>", methods=["GET"])
    @protect()
    @safe
    def download(self, pk: int):
        query = db.session.query(SqlaTable).filter_by(id=pk)
        item  = query.one_or_none()
        if item is None:
          return self.response_404()
        
        engine = item.database.get_sqla_engine()
        sql = f'SELECT * FROM "{item.schema}"."{item.table_name}" ' if item.schema is not None else f'SELECT * FROM "{item.table_name}"'
        df = pd.read_sql_query(sql=sql, con=engine)
        config = app.config
        csv = df.to_csv(index=False,  **config["CSV_EXPORT"])
        response = Response(csv, mimetype="text/csv")
        response.headers[
            "Content-Disposition"
        ] = f"attachment; filename={item.table_name}.csv"
        return response

