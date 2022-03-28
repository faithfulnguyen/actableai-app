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
from collections import Counter

from flask import request, Response, abort
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from sqlalchemy.orm.exc import NoResultFound

from superset import db, models, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.core import Database
from superset.views.utils import get_savedquery_by_table_id

from .base import api, BaseSupersetView, handle_api_exception, json_error_response
from superset.exceptions import SupersetSecurityException
from superset.connectors.sqla.models import SqlaTable

class Datasource(BaseSupersetView):
    """Datasource-related views"""

    @expose("/save/", methods=["POST"])
    @has_access_api
    @api
    @handle_api_exception
    def save(self) -> Response:
        data = request.form.get("data")
        if not isinstance(data, str):
            return json_error_response("Request missing data field.", status="500")

        datasource_dict = json.loads(data)
        datasource_id = datasource_dict.get("id")
        datasource_type = datasource_dict.get("type")
        database_id = datasource_dict["database"].get("id")
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        
        if not security_manager.can_edit_datasource(table_id=datasource_id):
            return json_error_response(f"You don't have the permission to edit datasource",status="403")
            
        orm_datasource.database_id = database_id

        if "owners" in datasource_dict and orm_datasource.owner_class is not None:
            datasource_dict["owners"] = (
                db.session.query(orm_datasource.owner_class)
                .filter(orm_datasource.owner_class.id.in_(datasource_dict["owners"]))
                .all()
            )

        duplicates = [
            name
            for name, count in Counter(
                [col["column_name"] for col in datasource_dict["columns"]]
            ).items()
            if count > 1
        ]
        if duplicates:
            return json_error_response(
                f"Duplicate column name(s): {','.join(duplicates)}", status="409"
            )
        orm_datasource.update_from_object(datasource_dict)
        data = orm_datasource.data
        db.session.commit()

        return self.json_response(data)

    @expose("/get/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def get(self, datasource_type: str, datasource_id: int) -> Response:
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )

        columnsData = []
        columnsName = []
        columnsValues = []
        groupValues = {}
        columns = orm_datasource.data['columns']
        for column in columns:
            data = orm_datasource.values_for_column(column['column_name'])
            inValue = []
            for value in data:
                if value is not None:
                    inValue.append({"label": str(value), "value": str(value)})
                    groupValues[column['column_name']] = inValue
            if column['type'] is not None:
                if (column['type'].find('VARCHAR') != -1 or
                    column['type'].find('TEXT') != -1 or
                    column['type'].find('STRING') != -1):
                    columnsName.append(column['column_name'])
                    data = orm_datasource.values_for_column(
                        column['column_name'])
                    for value in data:
                        if value is not None:
                            columnsData.append(column['column_name'] + ":" + value.replace(' ', '_'))
                            columnsValues.append({
                                'column': column['column_name'],
                                'value': value
                            })
                elif (column['type'].find('INT') != -1 or
                        column['type'].find('FLOAT') != -1 or
                        column['type'].find('DOUBLE') != -1 or
                        column['type'].find('SERIAL') != -1 or
                        column['type'].find('DECIMAL') != -1 or
                        column['type'].find('NUMERIC')!= -1  or
                        column['type'].find('TIME')!= -1  or
                        column['type'].find('DATE')!= -1  or
                        column['type'].find('REAL') != -1 or
                        column['type'].find('OBJECT') != -1):
                    columnsName.append(column['column_name'])
                    columnsData.append(column['column_name'])
                    columnsValues.append({
                        'column': column['column_name']
                    })

        data = orm_datasource.data
        data['columns_positive'] = columnsData
        data['columns_name'] = columnsName
        data['columns_values'] = columnsValues
        data['group_values'] = groupValues
        if data["sql"] is not None:
            saved_query = get_savedquery_by_table_id(datasource_id, db.session)
            if saved_query:
                data["saved_query_id"] = saved_query.id

        if not orm_datasource:
            return json_error_response("This datasource does not exist", status="400")
        elif not orm_datasource.data:
            return json_error_response("Error fetching datasource data.", status="500")

        return data

    @expose("/external_metadata/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def external_metadata(self, datasource_type: str, datasource_id: int) -> Response:
        """Gets column info from the source system"""
        if datasource_type == "druid":
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session
            )
        elif datasource_type == "table":
            database = (
                db.session.query(Database).filter_by(id=request.args.get("db_id")).one()
            )
            table_class = ConnectorRegistry.sources["table"]
            datasource = table_class(
                database=database,
                table_name=request.args.get("table_name"),
                schema=request.args.get("schema") or None,
            )
        else:
            raise Exception(f"Unsupported datasource_type: {datasource_type}")
        external_metadata = datasource.external_metadata()
        return self.json_response(external_metadata)
