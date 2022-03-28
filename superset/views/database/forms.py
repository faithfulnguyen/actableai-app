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
"""Contains the logic to create cohesive forms on the explore view"""
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_babel import lazy_gettext as _
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import BooleanField, IntegerField, SelectField, StringField, HiddenField
from wtforms.ext.sqlalchemy.fields import QuerySelectField
from wtforms.validators import DataRequired, Length, NumberRange, Optional, Regexp

from superset import app, db, security_manager
from superset.forms import CommaSeparatedListField, filter_not_empty_values
from superset.models import core as models
from superset.models.custom import Workspace
from flask import g
config = app.config


class BS3TextFieldRegexTableNameWidget(BS3TextFieldWidget):
    def __call__(self, field, **kwargs):
        kwargs['pattern'] = '[a-zA-Z0-9_]+'
        kwargs['title'] = 'Table name can contain only characters a-z, A-Z, 0-9 and _'
        return super(BS3TextFieldRegexTableNameWidget, self).__call__(field, **kwargs)


class CsvToDatabaseForm(DynamicForm):
    # pylint: disable=E0211
    def csv_allowed_dbs():  # type: ignore
        csv_allowed_dbs = []
        beta_user = security_manager.is_beta_user()
        if beta_user: 
            workspace = Workspace.get_or_create_workspace(g.user)
            csv_enabled_dbs = db.session().query(models.Database).filter(
                (models.Database.created_by_fk == g.user.get_id()) | (models.Database.id == workspace.db_id)
            ).filter_by(allow_csv_upload=True).all()    
            for csv_enabled_db in csv_enabled_dbs:
                if CsvToDatabaseForm.at_least_one_schema_is_allowed(csv_enabled_db):
                    csv_allowed_dbs.append(csv_enabled_db)
        else:
            csv_enabled_dbs = (
                db.session.query(models.Database).filter_by(allow_csv_upload=True).all()
            )
            for csv_enabled_db in csv_enabled_dbs:
                if CsvToDatabaseForm.at_least_one_schema_is_allowed(csv_enabled_db):
                    csv_allowed_dbs.append(csv_enabled_db)
                    
        return csv_allowed_dbs

    @staticmethod
    def at_least_one_schema_is_allowed(database):
        """
        If the user has access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is able to upload csv without specifying schema name
                b) if database supports schema
                    user is able to upload csv to any schema
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and upload will fail
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        elif the user does not access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is unable to upload csv
                b) if database supports schema
                    user is unable to upload csv
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and user is unable to upload csv
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        """
        if (
            security_manager.can_access_database(database)
            or security_manager.can_access_all_datasources()
            or security_manager.database_access_owned(database)
        ):
            return True
        schemas = database.get_schema_access_for_csv_upload()
        if schemas and security_manager.schemas_accessible_by_user(
            database, schemas, False
        ):
            return True
        return False

    name = StringField(
        _("Table Name"),
        description=_("Name of table to be created from csv data."),
        validators=[DataRequired()],
        widget=BS3TextFieldRegexTableNameWidget(),
    )
    csv_file = FileField(
        _("CSV File"),
        description=_("Select a CSV file to be uploaded to a database."),
        validators=[
            FileRequired(),
            FileAllowed(
                config["ALLOWED_EXTENSIONS"].intersection(config["CSV_EXTENSIONS"]),
                _(
                    "Only the following file extensions are allowed: "
                    "%(allowed_extensions)s",
                    allowed_extensions=", ".join(
                        config["ALLOWED_EXTENSIONS"].intersection(
                            config["CSV_EXTENSIONS"]
                        )
                    ),
                ),
            ),
        ],
    )
    
    is_public = BooleanField(
        _("Is public dataset"),
        render_kw ={'checked': False },
        description=_("Public data sets are seen by other users but analytics using them are free of charge")
    )
    
    con = QuerySelectField(
        _("Database"),
        query_factory=csv_allowed_dbs,
        get_pk=lambda a: a.id,
        get_label=lambda a: a.database_name,
        render_kw={"display": "hidden"}
    )
    schema = StringField(
        _("Schema"),
        description=_("Specify a schema (if database flavor supports this)."),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    sep = StringField(
        _("Delimiter"),
        description=_("Delimiter used by CSV file (for whitespace use \\s+)."),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    if_exists = SelectField(
        _("Table Exists"),
        description=_(
            "If table exists do one of the following: "
            "Fail (do nothing), Replace (drop and recreate table) "
            "or Append (insert data)."
        ),
        choices=[
            ("fail", _("Fail")),
            ("replace", _("Replace")),
            ("append", _("Append")),
        ],
        validators=[DataRequired()],
        render_kw={"display": "hidden"}
    )
    header = IntegerField(
        _("Header Row"),
        description=_(
            "Row containing the headers to use as "
            "column names (0 is first line of data). "
            "Leave empty if there is no header row."
        ),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    index_col = IntegerField(
        _("Index Column"),
        description=_(
            "Column to use as the row labels of the "
            "dataframe. Leave empty if no index column."
        ),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    mangle_dupe_cols = BooleanField(
        _("Mangle Duplicate Columns"),
        description=_('Specify duplicate columns as "X.0, X.1".'),
        render_kw={"display": "hidden"}
    )
    skipinitialspace = BooleanField(
        _("Skip Initial Space"), description=_("Skip spaces after delimiter."),
        render_kw={"display": "hidden"}
    )
    skiprows = IntegerField(
        _("Skip Rows"),
        description=_("Number of rows to skip at start of file."),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    nrows = IntegerField(
        _("Rows to Read"),
        description=_("Number of rows of file to read."),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    skip_blank_lines = BooleanField(
        _("Skip Blank Lines"),
        description=_(
            "Skip blank lines rather than interpreting them " "as NaN values."
        ),
        render_kw={"display": "hidden"}
    )
    parse_dates = CommaSeparatedListField(
        _("Parse Dates"),
        description=_(
            "A comma separated list of columns that should be " "parsed as dates."
        ),
        filters=[filter_not_empty_values],
        render_kw={"display": "hidden"}
    )
    infer_datetime_format = BooleanField(
        _("Infer Datetime Format"),
        description=_("Use Pandas to interpret the datetime format " "automatically."),
        render_kw={"display": "hidden"}
    )
    decimal = StringField(
        _("Decimal Character"),
        default=".",
        description=_("Character to interpret as decimal point."),
        validators=[Optional(), Length(min=1, max=1)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    index = BooleanField(
        _("Dataframe Index"), description=_("Write dataframe index as a column."),
        render_kw={"display": "hidden"}
    )
    limit_size = HiddenField("Limit size")
    index_label = StringField(
        _("Column Label(s)"),
        description=_(
            "Column label for index column(s). If None is given "
            "and Dataframe Index is True, Index Names are used."
        ),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )


class ExcelToDatabaseForm(DynamicForm):
    # pylint: disable=E0211
    def excel_allowed_dbs():  # type: ignore
        excel_allowed_dbs = []
        beta_user = security_manager.is_beta_user()
        if beta_user: 
            workspace = Workspace.get_or_create_workspace(g.user)
            excel_enabled_dbs = db.session().query(models.Database).filter(
                (models.Database.created_by_fk == g.user.get_id()) | (models.Database.id == workspace.db_id)
            ).filter_by(allow_csv_upload=True).all()    
            for excel_enabled_db in excel_enabled_dbs:
                if CsvToDatabaseForm.at_least_one_schema_is_allowed(excel_enabled_db):
                    excel_allowed_dbs.append(excel_enabled_db)
        else:
            # TODO: change allow_csv_upload to allow_file_upload
            excel_enabled_dbs = (
                db.session.query(models.Database).filter_by(allow_csv_upload=True).all()
            )
            for excel_enabled_db in excel_enabled_dbs:
                if ExcelToDatabaseForm.at_least_one_schema_is_allowed(excel_enabled_db):
                    excel_allowed_dbs.append(excel_enabled_db)
        return excel_allowed_dbs

    @staticmethod
    def at_least_one_schema_is_allowed(database: models.Database) -> bool:
        """
        If the user has access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is able to upload excel without specifying schema name
                b) if database supports schema
                    user is able to upload excel to any schema
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and upload will fail
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        elif the user does not access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is unable to upload excel
                b) if database supports schema
                    user is unable to upload excel
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and user is unable to upload excel
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        """
        if (
            security_manager.can_access_database(database)
            or security_manager.can_access_all_datasources()
        ):
            return True
        schemas = database.get_schema_access_for_csv_upload()
        if schemas and security_manager.schemas_accessible_by_user(
            database, schemas, False
        ):
            return True
        return False

    name = StringField(
        _("Table Name"),
        description=_("Name of table to be created from excel data."),
        validators=[DataRequired()],
        widget=BS3TextFieldRegexTableNameWidget(),
    )
    excel_file = FileField(
        _("Excel File"),
        description=_("Select a Excel file to be uploaded to a database."),
        validators=[
            FileRequired(),
            FileAllowed(
                config["ALLOWED_EXTENSIONS"].intersection(config["EXCEL_EXTENSIONS"]),
                _(
                    "Only the following file extensions are allowed: "
                    "%(allowed_extensions)s",
                    allowed_extensions=", ".join(
                        config["ALLOWED_EXTENSIONS"].intersection(
                            config["EXCEL_EXTENSIONS"]
                        )
                    ),
                ),
            ),
        ],
    )

    sheet_name = StringField(
        _("Sheet Name"), description="Your sheet name", validators=[Optional()],
        widget=BS3TextFieldWidget(),
    )
    
    is_public = BooleanField(
        _("Is public dataset"),
        render_kw ={'checked': False },
        description=_("Public data sets are seen by other users but analytics using them are free of charge")
    )
    
    con = QuerySelectField(
        _("Database"),
        query_factory=excel_allowed_dbs,
        get_pk=lambda a: a.id,
        get_label=lambda a: a.database_name,
    )
    schema = StringField(
        _("Schema"),
        description=_("Specify a schema (if database flavor supports this)."),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    if_exists = SelectField(
        _("Table Exists"),
        description=_(
            "If table exists do one of the following: "
            "Fail (do nothing), Replace (drop and recreate table) "
            "or Append (insert data)."
        ),
        choices=[
            ("fail", _("Fail")),
            ("replace", _("Replace")),
            ("append", _("Append")),
        ],
        validators=[DataRequired()],
        render_kw={"display": "hidden"}
    )
    header = IntegerField(
        _("Header Row"),
        description=_(
            "Row containing the headers to use as "
            "column names (0 is first line of data). "
            "Leave empty if there is no header row."
        ),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    index_col = IntegerField(
        _("Index Column"),
        description=_(
            "Column to use as the row labels of the "
            "dataframe. Leave empty if no index column."
        ),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    mangle_dupe_cols = BooleanField(
        _("Mangle Duplicate Columns"),
        description=_('Specify duplicate columns as "X.0, X.1".'),
        render_kw={"display": "hidden"}
    )
    skipinitialspace = BooleanField(
        _("Skip Initial Space"), description=_("Skip spaces after delimiter."),
        render_kw={"display": "hidden"}
    )
    skiprows = IntegerField(
        _("Skip Rows"),
        description=_("Number of rows to skip at start of file."),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    nrows = IntegerField(
        _("Rows to Read"),
        description=_("Number of rows of file to read."),
        validators=[Optional(), NumberRange(min=0)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    decimal = StringField(
        _("Decimal Character"),
        default=".",
        description=_("Character to interpret as decimal point."),
        validators=[Optional(), Length(min=1, max=1)],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
    index = BooleanField(
        _("Dataframe Index"), description=_("Write dataframe index as a column."),
        render_kw={"display": "hidden"}
    )
    index_label = StringField(
        _("Column Label(s)"),
        description=_(
            "Column label for index column(s). If None is given "
            "and Dataframe Index is True, Index Names are used."
        ),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        render_kw={"display": "hidden"}
    )
