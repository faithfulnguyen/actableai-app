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
import os
import re
import tempfile
from typing import TYPE_CHECKING

from flask import flash, g, redirect
from flask_appbuilder import SimpleFormView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.widgets import ListWidget

from flask_babel import lazy_gettext as _
from superset.user_friendly_errors import get_user_friendly_error
from wtforms.fields import StringField
from wtforms.validators import ValidationError

import superset.models.core as models
from superset import app, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import RouteMethod
from superset.exceptions import CertificateException, SupersetSecurityException
from superset.utils import core as utils
from superset.views.base import DeleteMixin, SupersetModelView, YamlExportMixin

from .forms import CsvToDatabaseForm, ExcelToDatabaseForm
from .mixins import DatabaseMixin
from .validators import schema_allows_csv_upload, sqlalchemy_uri_validator
from werkzeug.wrappers import Response
from superset.sql_parse import Table
from superset.models.custom import ActableConfig
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

if TYPE_CHECKING:
    from werkzeug.datastructures import FileStorage  # pylint: disable=unused-import

config = app.config
stats_logger = config["STATS_LOGGER"]


def sqlalchemy_uri_form_validator(_, field: StringField) -> None:
    """
        Check if user has submitted a valid SQLAlchemy URI
    """
    sqlalchemy_uri_validator(field.data, exception=ValidationError)


def certificate_form_validator(_, field: StringField) -> None:
    """
        Check if user has submitted a valid SSL certificate
    """
    if field.data:
        try:
            utils.parse_ssl_cert(field.data)
        except CertificateException as ex:
            raise ValidationError(ex.message)


def upload_stream_write(form_file_field: "FileStorage", path: str):
    chunk_size = app.config["UPLOAD_CHUNK_SIZE"]
    with open(path, "bw") as file_description:
        while True:
            chunk = form_file_field.stream.read(chunk_size)
            if not chunk:
                break
            file_description.write(chunk)


class DatabaseListWidget(ListWidget):
     template = 'superset/fab_overrides/widgets/database/list.html'

class DatabaseView(
    DatabaseMixin, SupersetModelView, DeleteMixin, YamlExportMixin
):  # pylint: disable=too-many-ancestors

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        app.jinja_env.globals.update(
            check_role_manage=self.check_role_manage
        )
    datamodel = SQLAInterface(models.Database)
    include_route_methods = RouteMethod.CRUD_SET

    list_widget = DatabaseListWidget
    add_template = "superset/models/database/add.html"
    edit_template = "superset/models/database/edit.html"
    # list_template = "superset/models/database/list.html"
    
    validators_columns = {
        "sqlalchemy_uri": [sqlalchemy_uri_form_validator],
        "server_cert": [certificate_form_validator],
    }

    yaml_dict_key = "databases"

    search_columns = ('database_name', 'db_name')

    def has_permission_to_action(self, pk):
        # For beta user who can see example database but does not have 
        # permission to Show detail/Edit/Delete
        item = self.datamodel.get(pk, self._base_filters)
        if security_manager.is_beta_user() and item.created_by_fk != g.user.id:
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                    message="You don't have the rights permission",
                    level=ErrorLevel.ERROR
                )
            )

    def _delete(self, pk):
        self.has_permission_to_action(pk)
        DeleteMixin._delete(self, pk)

    def _show(self, pk):
        self.has_permission_to_action(pk)
        return super()._show(pk)
    
    def _edit(self, pk):
        self.has_permission_to_action(pk)
        return super()._edit(pk)
        
    def check_role_manage(self, created_by_fk):
        if security_manager.is_beta_user() and  created_by_fk != g.user.id:
            return False
        return True

class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_template = "superset/form_view/csv_to_database_view/edit.html"
    form_title = _("CSV to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form):
        limit_size_data = db.session.query(ActableConfig).filter_by(name="FILE_UPLOAD_LIMIT_SIZE").one_or_none()
        if not limit_size_data:
            limit_size_data = ActableConfig(name='FILE_UPLOAD_LIMIT_SIZE', value='10')
            db.session.add(limit_size_data)
            db.session.commit()
        form.sep.data = ","
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = "."
        form.if_exists.data = "fail"
        form.limit_size.data = limit_size_data.value

    def form_post(self, form: CsvToDatabaseForm) -> Response:
        database = form.con.data
        schema_name = form.schema.data or ""

        if not schema_allows_csv_upload(database, schema_name):
            message = _(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for csv uploads. Please contact your Actable Admin.",
                database_name=database.database_name,
                schema_name=schema_name,
            )
            flash(message, "danger")
            return redirect("/csvtodatabaseview/form")

        csv_file = form.csv_file.data
        csv_filename = form.csv_file.data.filename
        extension = os.path.splitext(csv_filename)[1].lower()
        path = tempfile.NamedTemporaryFile(
            dir=app.config["UPLOAD_FOLDER"], suffix=extension, delete=False
        ).name
        form.csv_file.data.filename = path

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            csv_file.save(path)
            table_name = form.name.data
            regex = re.compile('[a-zA-Z0-9_]+')
            match_data = regex.findall(table_name)
            if len(match_data) == 0 or len(match_data) > 1:
                flash("Table name can contain only characters a-z, A-Z, 0-9 and _", "danger")
                return redirect("/csvtodatabaseview/form")

            con = form.data.get("con")
            database = (
                db.session.query(models.Database).filter_by(id=con.data.get("id")).one()
            )
            create_table_result = database.db_engine_spec.create_table_from_csv(form, database)
            table = (
                db.session.query(SqlaTable)
                    .filter_by(
                    table_name=table_name,
                    schema=form.schema.data,
                    database_id=database.id,
                )
                    .one_or_none()
            )
            if table:
                table.fetch_metadata()
            if not table:
                table = SqlaTable(table_name=table_name)
                table.database = database
                table.database_id = database.id
                table.user_id = g.user.id
                table.schema = form.schema.data
                table.is_uploaded = True
                table.set_is_public(form.data.get("is_public"))
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
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg= get_user_friendly_error(e.args[0]) if not e.args is None else str(e)
            )

            flash(message, "danger")
            stats_logger.incr("failed_csv_upload")

            return redirect("/csvtodatabaseview/form")

        os.remove(path)
        # Go back to welcome page / splash screen
        message = _(
            'CSV file "%(csv_filename)s" uploaded to tables "%(table_name)s" in '
            'database "%(db_name)s".' + create_table_result['warning_msg'],
            csv_filename=csv_filename,
            table_name=form.name.data,
            db_name=table.database.database_name,
        )
        flash(message, "info")
        stats_logger.incr("successful_csv_upload")
        
        return redirect("/")


class ExcelToDatabaseView(SimpleFormView):
    form = ExcelToDatabaseForm
    form_template = "superset/form_view/excel_to_database_view/edit.html"
    form_title = _("Excel to Database configuration")
    add_columns = ["database", "schema", "table_name"]

    def form_get(self, form: ExcelToDatabaseForm) -> None:
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.decimal.data = "."
        form.if_exists.data = "fail"
        form.sheet_name = None

    def form_post(self, form: ExcelToDatabaseForm) -> Response:
        database = form.con.data
        excel_table = Table(table=form.name.data, schema=form.schema.data)
        regex = re.compile('[a-zA-Z0-9_]+')
        match_data = regex.findall(excel_table.table)
        if len(match_data) == 0 or len(match_data) > 1:
            flash("Table name can contain only characters a-z, A-Z, 0-9 and _", "danger")
            return redirect("/exceltodatabaseview/form")

        if not schema_allows_csv_upload(database, excel_table.schema):
            message = _(
                'Database "%(database_name)s" schema "%(schema_name)s" '
                "is not allowed for excel uploads. Please contact your Actable Admin.",
                database_name=database.database_name,
                schema_name=excel_table.schema,
            )
            flash(message, "danger")
            return redirect("/exceltodatabaseview/form")

        if "." in excel_table.table and excel_table.schema:
            message = _(
                "You cannot specify a namespace both in the name of the table: "
                '"%(excel_table.table)s" and in the schema field: '
                '"%(excel_table.schema)s". Please remove one',
                table=excel_table.table,
                schema=excel_table.schema,
            )
            flash(message, "danger")
            return redirect("/exceltodatabaseview/form")

        uploaded_tmp_file_path = tempfile.NamedTemporaryFile(
            dir=app.config["UPLOAD_FOLDER"],
            suffix=os.path.splitext(form.excel_file.data.filename)[1].lower(),
            delete=False,
        ).name

        try:
            utils.ensure_path_exists(config["UPLOAD_FOLDER"])
            upload_stream_write(form.excel_file.data, uploaded_tmp_file_path)

            con = form.data.get("con")
            database = (
                db.session.query(models.Database).filter_by(id=con.data.get("id")).one()
            )
            excel_to_df_kwargs = {
                "header": form.header.data if form.header.data else 0,
                "index_col": form.index_col.data,
                "mangle_dupe_cols": form.mangle_dupe_cols.data,
                "skipinitialspace": form.skipinitialspace.data,
                "skiprows": form.skiprows.data,
                "nrows": form.nrows.data,
                "sheet_name": form.sheet_name.data,
                "chunksize": 1000,
            }
            df_to_sql_kwargs = {
                "name": excel_table.table,
                "if_exists": form.if_exists.data,
                "index": form.index.data,
                "index_label": form.index_label.data,
                "chunksize": 1000,
            }
            database.db_engine_spec.create_table_from_excel(
                uploaded_tmp_file_path,
                excel_table,
                database,
                excel_to_df_kwargs,
                df_to_sql_kwargs,
            )

            # Connect table to the database that should be used for exploration.
            # E.g. if hive was used to upload a excel, presto will be a better option
            # to explore the table.
            expore_database = database
            explore_database_id = database.get_extra().get("explore_database_id", None)
            if explore_database_id:
                expore_database = (
                        db.session.query(models.Database)
                        .filter_by(id=explore_database_id)
                        .one_or_none()
                        or database
                )

            sqla_table = (
                db.session.query(SqlaTable)
                    .filter_by(
                    table_name=excel_table.table,
                    schema=excel_table.schema,
                    database_id=expore_database.id,
                )
                    .one_or_none()
            )

            if sqla_table:
                sqla_table.fetch_metadata()
            if not sqla_table:
                sqla_table = SqlaTable(table_name=excel_table.table)
                sqla_table.database = expore_database
                sqla_table.database_id = database.id
                sqla_table.user_id = g.user.id
                sqla_table.schema = excel_table.schema
                sqla_table.is_uploaded = True
                sqla_table.set_is_public(form.data.get("is_public"))
                sqla_table.fetch_metadata()
                db.session.add(sqla_table)
            
            db.session.commit()
        except Exception as ex:  # pylint: disable=broad-except
            db.session.rollback()
            try:
                os.remove(uploaded_tmp_file_path)
            except OSError:
                pass
            message = _(
                'Unable to upload Excel file "%(filename)s" to table '
                '"%(table_name)s" in database "%(db_name)s". '
                "Error message: %(error_msg)s",
                filename=form.excel_file.data.filename,
                table_name=form.name.data,
                db_name=database.database_name,
                error_msg=str(ex),
            )

            flash(message, "danger")
            stats_logger.incr("failed_excel_upload")
            return redirect("/exceltodatabaseview/form")

        os.remove(uploaded_tmp_file_path)
        # Go back to welcome page / splash screen
        message = _(
            'CSV file "%(excel_filename)s" uploaded to table "%(table_name)s" in '
            'database "%(db_name)s"',
            excel_filename=form.excel_file.data.filename,
            table_name=str(excel_table),
            db_name=sqla_table.database.database_name,
        )
        flash(message, "info")
        stats_logger.incr("successful_excel_upload")
        return redirect("/")
