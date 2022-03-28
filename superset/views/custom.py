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
from asyncio.log import logger
import logging
import dialogflow_v2 as dialogflow
import datetime
import os
import re
import simplejson as json
import uuid
from flask import request, g, flash, session, redirect, abort, Response
from flask_login import login_user
from flask_appbuilder import expose
from flask_wtf.form import FlaskForm
from flask_appbuilder.security.sqla import models as ab_models
from wtforms import StringField, PasswordField
from wtforms.validators import Email, DataRequired, EqualTo
from superset.models.dashboard import Dashboard
from superset.utils import core as utils
from superset.utils import hubspot_registration

from superset import (
    appbuilder,
    db,
    security_manager,
    google,
    app,
    event_logger
)
from sqlalchemy.exc import IntegrityError
from superset.connectors.sqla.models import TableColumn, SqlaTable
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils.token import get_token, verify_token
from superset.utils.mailgun import MailGun
from superset.billing.utils import activate_trial
from superset.models.custom import CustomOntology
from superset.utils.fulfillment import (
    get_list_entity,
    get_status_train_before,
    train_mapping,
    get_status_train_process
)
from superset.models import custom as modelsCustom
from superset.models.slice import Slice
from .base import (
    BaseSupersetView,
    DeleteMixin,
    SupersetModelView,
    common_bootstrap_payload,
    check_ownership,
    json_success
)
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from flask_appbuilder.security.decorators import has_access

from superset.prediction.causal_inference import causal_inference_task
from superset.prediction.forecast import forecast_task
from superset.prediction.correlation import correlation_task
from superset.prediction.regression import regression_task
from superset.prediction.sentiment_analysis import sentiment_task
from superset.prediction.classification import classification_task
from superset.prediction.clustering import clustering_task
from superset.prediction.data_imputation import data_imputation_task
from superset.prediction.stats_models import anova_task

from werkzeug import check_password_hash
import requests
from sqlalchemy import or_
from flask_appbuilder.api import BaseApi, expose, protect, safe
from superset.utils.stripe import Stripe

class ForgotPassword(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email()])


class ResetPassword(FlaskForm):
    token = StringField("Token", validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password', validators=[
        DataRequired(), EqualTo('password')])


class OverfitView(BaseSupersetView):
    """The custom views for Superset!"""
    route_base = "/"

    @has_access
    @expose("/docs/", methods=["GET"])
    def docs(self):
        """Docs redirect link superset"""
        docs_link = app.config.get("DOCS_LINK")
        return redirect(docs_link, code=302)

    @expose("/dialogflow/", methods=["GET", "POST"])
    def chat(self):
        """The chat views for Superset!"""
        app_name = app.config.get("APP_NAME")
        form = FlaskForm()
        return self.render_template(
            "superset/dialog_flow.html",
            bootstrap_data=json.dumps({"app_name": app_name}),
            entry="dialogflow",
            title="Dialogflow Client",
            form=form,
        )


    @has_access
    @expose("/api/dialogflow", methods=["POST"])
    def send_message(self):
        message = request.form.get('message')
        username = g.user.username
        user = (
            db.session.query(ab_models.User).filter_by(
                username=username).one_or_none()
        )
        send_mes = {
            'message': message,
            'userEmail': user.email,
            'supersetDomain': app.config.get("SUPERSET_DOMAIN"),
        }
        project_id = os.environ.get("DIALOGFLOW_PROJECT_ID")
        fulfillment_text = self.detect_intent_texts(
            project_id, uuid.uuid4(), json.dumps(send_mes), 'en')
        response_text = {'message': fulfillment_text}

        return json.dumps(response_text)

    def detect_intent_texts(self, project_id, session_id, text, language_code):
        session_client = dialogflow.SessionsClient()
        session = session_client.session_path(project_id, session_id)
        if text:
            text_input = dialogflow.types.TextInput(
                text=text, language_code=language_code)
            query_input = dialogflow.types.QueryInput(text=text_input)
            response = session_client.detect_intent(
                session=session, query_input=query_input)
            try:
                response_text = response.query_result.fulfillment_messages[0] \
                    .simple_responses.simple_responses[0].display_text
            except Exception:
                response_text = response.query_result.fulfillment_text
        return response_text

    @expose("/forgotpassword/", methods=["GET", "POST"])
    def forgot_password(self):
        if not g.user.is_anonymous:
            return redirect("/")

        form = ForgotPassword(request.form)
        if request.method == "POST":
            if form.validate():
                email = request.form.get('email')
                user = db.session.query(ab_models.User).filter_by(
                    email=email).first()
                if user:
                    mail_gun = MailGun()
                    mail_gun.send_forgot_password(
                        email, get_token(user.get_id()))

                content = "If the email you specified exists in our system, " \
                          "we've sent a password reset link to it."
                return self.render_template(
                    "superset/forgot_password_notify.html", content=content)
            else:
                flash("Incorrect format", "danger")

        return self.render_template("superset/forgot_password.html",
                                    form=form)

    @expose("/api/correlation/save-job/<job_id>", methods=["POST"])
    def save_correlation_job(self, job_id):
        task = correlation_job.delay(job_id)
        return json.dumps({"task_id": task.id})

    @expose("/api/correlation/task/<task_id>", methods=["GET"])
    def get_correlcation_job(self, task_id):
        task = correlation_job.AsyncResult(task_id)
        if task.state != "SUCCESS":
            return {
                "data": [],
                "status": task.state
            }
        return task.get()

    @expose("/resetpassword/", methods=["GET", "POST"])
    def reset_password(self):
        if not g.user.is_anonymous:
            return redirect("/")

        token = request.args.get("token", None)
        id = verify_token(token)
        if id is None:
            content = "Sorry, the link has expired. Please return to the " \
                      "<a href='/forgotpassword'>Reset Password</a> " \
                      "page to submit a new request."
            return self.render_template("superset/forgot_password_notify.html",
                                        content=content)

        form = ResetPassword(token=token)
        if request.method == "POST":
            if form.validate():
                appbuilder.sm.reset_password(id, request.form.get("password"))
                content = "Your password has been reset successfully! " \
                          "Go to <a href='/login/'>Login</a> page."
                return self.render_template(
                    "superset/forgot_password_notify.html", content=content)
            else:
                flash("Confirm password doesn't match", "danger")

        return self.render_template("superset/reset_password.html",
                                    form=form)

    @has_access
    @expose("/api/task/<task_id>", methods=["DELETE"])
    def cancel_task(self, task_id):
        from superset.extensions import celery_app
        celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
        return json.dumps({"success": True})

    @has_access
    @expose("/api/chart/<chart_id>", methods=["PUT"])
    def update_taskid_chart(self, chart_id):
        chart = db.session.query(Slice).filter_by(id=chart_id).one()
        params = json.loads(chart.params)
        params["taskId"] = request.json.get('taskId')
        db.session.query(Slice).filter_by(
            id=chart_id).update({"params": json.dumps(params)})
        db.session.commit()
        return json.dumps({"success": True})

    @expose("/dashboard/public/<dashboard_id>/")
    def dashboardPublic(self, dashboard_id):
        form = ForgotPassword(request.form)
        """Server side rendering for a dashboard"""
        session = db.session()
        qry = session.query(Dashboard)
        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(uuid=dashboard_id)

        dash = qry.one_or_none()
        if not dash:
            abort(404)
        datasources = set()
        for slc in dash.slices:
            datasource = slc.datasource
            if datasource:
                datasources.add(datasource)

        config = app.config
        if config["ENABLE_ACCESS_REQUEST"]:
            for datasource in datasources:
                if datasource and not security_manager.can_access_datasource(datasource):
                    flash(
                        _(
                            security_manager.get_datasource_access_error_msg(datasource)
                        ),
                        "danger",
                    )
                    return redirect(
                        "superset/request_access/?" f"dashboard_id={dash.id}&"
                    )

        dash_edit_perm = check_ownership(
            dash, raise_if_false=False
        ) and security_manager.can_access("can_save_dash", "Superset")
        dash_save_perm = security_manager.can_access("can_save_dash", "Superset")
        superset_can_explore = security_manager.can_access("can_explore", "Superset")
        superset_can_csv = security_manager.can_access("can_csv", "Superset")
        slice_can_edit = security_manager.can_access("can_edit", "SliceModelView")

        standalone_mode = (
                request.args.get(utils.ReservedUrlParameters.STANDALONE.value) == "true"
        )

        # Hack to log the dashboard_id properly, even when getting a slug
        @event_logger.log_this
        def dashboard(**kwargs):
            pass

        dashboard(
            dashboard_id=dash.id,
            dashboard_version="v2",
            dash_edit_perm=False,
            edit_mode=False,
        )

        dashboard_data = dash.data
        dashboard_data.update(
            {
                "standalone_mode": standalone_mode,
                "dash_save_perm": dash_save_perm,
                "dash_edit_perm": dash_edit_perm,
                "superset_can_explore": superset_can_explore,
                "superset_can_csv": superset_can_csv,
                "slice_can_edit": slice_can_edit,
            }
        )
        url_params = {
            key: value
            for key, value in request.args.items()
            if key not in [param.value for param in utils.ReservedUrlParameters]
        }

        env_config = {
            "CLASSIFICATION_ANALYTICS_FEATURE": app.config.get('CLASSIFICATION_ANALYTICS_FEATURE'),
            "REGRESSION_ANALYTICS_FEATURE": app.config.get('REGRESSION_ANALYTICS_FEATURE'),
            "SUNBURST_CHART_FEATURE": app.config.get('SUNBURST_CHART_FEATURE'),
            "SANKEY_DIAGRAM_FEATURE": app.config.get('SANKEY_DIAGRAM_FEATURE'),
            "NIGHTINGALE_ROSE_CHART_FEATURE": app.config.get('NIGHTINGALE_ROSE_CHART_FEATURE'),
            "PARTITION_CHART_FEATURE": app.config.get('PARTITION_CHART_FEATURE'),
            "FORCE_DIRECTED_GRAPH_FEATURE": app.config.get('FORCE_DIRECTED_GRAPH_FEATURE'),
            "CHORD_DIAGRAM_FEATURE": app.config.get('CHORD_DIAGRAM_FEATURE'),
            "DASHBOARD_FEATURE": app.config.get('DASHBOARD_FEATURE'),
        }
        bootstrap_data = {
            "user_id": g.user.get_id(),
            "dashboard_data": dashboard_data,
            "datasources": {ds.uid: ds.data for ds in datasources},
            "common": common_bootstrap_payload(True),
            "editMode": False,
            "urlParams": url_params,
            "env": env_config,
            "anonymous": True,
        }

        if not dash.is_public:
            if not g.user.is_anonymous:
                return self.render_template(
                    "superset/dashboard.html",
                    entry="dashboard",
                    form=form,
                    bootstrap_data=json.dumps(
                        bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
                    )
                )
            else:
                bootstrap_data.update({"message": "This dashboard is no longer public"})
                return self.render_template(
                    "superset/dashboard_public.html",
                    entry="dashboard",
                    form=form,
                    bootstrap_data=json.dumps(
                        bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
                    )
                )

        if request.args.get("json") == "true":
            return json_success(
                json.dumps(bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser)
            )

        return self.render_template(
            "superset/dashboard_public.html",
            entry="dashboard",
            standalone_mode=standalone_mode,
            title=dash.dashboard_title,
            bootstrap_data=json.dumps(
                bootstrap_data, default=utils.pessimistic_json_iso_dttm_ser
            ),
            form=form
        )

    @expose("/api/table/check-existed", methods=["POST"])
    def linkedin_check_table_existed(self):
        import logging
        prefix = request.form['prefix'].replace('"','')
        existed_table = db.session.query(SqlaTable).filter_by(table_name='{}_profile'.format(prefix)).one_or_none()
        logging.info(existed_table)
        if existed_table:
            flash('Table with prefix {} has been existed'.format(prefix), 'danger')
            return json.dumps({"message": 'OK'.format(prefix), "status": False})

        return json.dumps({"message": 'OK'.format(prefix), "status": True})

    # Check for table existence when running plugin from google sheet
    @has_access
    @expose("/api/databases/<database_id>/tables/<table_name>", methods=["GET"])
    def check_table_exists_by_name(self, database_id, table_name):
        from urllib.parse import unquote

        table = db.session.query(SqlaTable).filter_by(table_name=unquote(table_name), database_id=database_id).one_or_none()
        if not table:
            return json.dumps({"is_existed": False})
        return json.dumps({"is_existed": True, "id": table.id})

class ActableConfigView(SupersetModelView, DeleteMixin):
    route_base = "/system-config"
    datamodel = SQLAInterface(modelsCustom.ActableConfig)

    list_title = _("Actable Config")
    list_columns = ['name', 'value', 'changed_by_', 'changed_on_']
    add_columns = ["name", "value"]
    edit_columns = add_columns
    search_columns = ('name', 'value')


class SapModelView(SupersetModelView, DeleteMixin):
    route_base = "/sap"
    datamodel = SQLAInterface(modelsCustom.SapConnectInfo)

    list_title = _("Sap Connect Info")

    label_columns = {
        'running': 'Status'
    }

    list_columns = [
        "end_point",
        "api_key",
        'success',
        'running',
    ]
    edit_columns = [
        "name",
        "end_point",
        "api_key",
    ]
    order_columns = [""]

    @expose("/add", methods=["GET", "POST"])
    @has_access
    def add(self):
        if request.method == 'GET':
            return self.render_template(
                "superset/basic.html",
                bootstrap_data=json.dumps({}),
                entry="sap",
                title="Connection to SAP"
            )

        if request.method == 'POST':
            try:
                existing_con = (
                    db.session.query(modelsCustom.SapConnectInfo)
                        .filter_by(end_point=request.form['end_point'].strip(),
                                   api_key=request.form['api_key'].strip())
                        .one_or_none()
                )
                if existing_con:
                    existing_con.group_id = request.form['group_id'].strip()
                    db.session.commit()
                else:
                    newForm = modelsCustom.SapConnectInfo(
                        request.form['name'].strip(),
                        request.form['end_point'].strip(),
                        request.form['api_key'].strip(),
                        request.form['group_id'].strip(),
                    )
                    db.session.add(newForm)
                    db.session.commit()
                return {
                    'message': 'Success'
                }
            except Exception:
                return {
                    'message': 'error'
                }


class LinkedinModelView(SupersetModelView, DeleteMixin):
    route_base = "/linkedin"
    datamodel = SQLAInterface(modelsCustom.LinkedinConnectInfo)

    label_columns = {
        'running': 'Status',
        "prefix": _("Table prefix"),
    }

    list_title = _('Linkedin connect information')
    edit_title = _('Edit linkedin connect information')
    order_columns = [""]

    list_columns = [
        "email",
        "prefix",
        'sample_rate',
        'success',
        'running',
    ]

    edit_columns = None

    @expose("/add", methods=["GET", "POST"])
    @has_access
    def add(self):
        if request.method == 'GET':
            return self.render_template(
                "superset/basic.html",
                bootstrap_data=json.dumps({'email': g.user.email}),
                entry="linkedin",
                title="Add linkedin connect info"
            )

        if request.method == 'POST':
            prefix = request.form['prefix'].lower()
            existTable = db.session.query(SqlaTable).filter_by(table_name=prefix + '_profile').one_or_none()
            if existTable:
                flash('Table has been existed', 'danger')
                return redirect("/linkedin/list/")
            try:
                profile_query = 'CREATE TABLE IF NOT EXISTS {}_profile (path text primary key, name text, title text, ' \
                                'location text); ' \
                                'CREATE TABLE IF NOT EXISTS  {}_experience (profile_path text,title text,' \
                                'company_name text, company_path text, from_date text, to_date text, primary key(' \
                                'profile_path, company_path, from_date)); ' \
                                'CREATE TABLE IF NOT EXISTS  {}_education (profile_path text, school_path text, ' \
                                'school_name text, specialized text, from_date text, to_date text, primary key(' \
                                'profile_path, school_path, from_date)); ' \
                                'CREATE TABLE IF NOT EXISTS {}_license_certification(profile_path text, ' \
                                'title text, company_path text, company_name text, issued_date text, primary key(' \
                                'profile_path, title, company_path)); ' \
                                'CREATE TABLE IF NOT EXISTS {}_skill(profile_path text, title text, endorsed int, ' \
                                'primary key(profile_path, title)); '.format(prefix, prefix, prefix, prefix, prefix)

                db.session.execute(profile_query)

                database = utils.get_example_database()
                profile_obj = SqlaTable(table_name=prefix + "_profile")
                experience_obj = SqlaTable(table_name=prefix + "_experience")
                education_obj = SqlaTable(table_name=prefix + "_education")
                certificate_obj = SqlaTable(table_name=prefix + "_license_certification")
                skill_obj = SqlaTable(table_name=prefix + "_skill")

                profile_obj.database = database
                experience_obj.database = database
                education_obj.database = database
                certificate_obj.database = database
                skill_obj.database = database

                db.session.merge(profile_obj)
                db.session.merge(experience_obj)
                db.session.merge(education_obj)
                db.session.merge(certificate_obj)
                db.session.merge(skill_obj)

                db.session.commit()

                profile_obj.fetch_metadata()
                experience_obj.fetch_metadata()
                education_obj.fetch_metadata()
                certificate_obj.fetch_metadata()
                skill_obj.fetch_metadata()

                new_form = modelsCustom.LinkedinConnectInfo(
                    request.form['email'],
                    request.form['group_id'],
                    request.form['search_url'],
                    request.form['prefix'].lower(),
                    request.form['sample_rate'],
                    1,
                    0,
                    request.form['temp_cookies'],
                )

                db.session.add(new_form)
                db.session.commit()
                return {
                    'message': 'success'
                }
            except Exception as e:
                return {
                    'message': e
                }


class MappingEntityView(BaseSupersetView):
    """The mappine entity views for Superset!"""
    route_base = "/mappingentity"

    @has_access
    @expose("/")
    def mapping_entity(self):
        query = ConnectorRegistry.get_all_datasources(db.session)
        tables = []
        if security_manager.can_access_all_databases():
            tables = query
        else:
            for table in query:
                if (
                        security_manager.can_access(
                            "datasource_access", table.perm)
                        or security_manager.datasource_access_owned(table)
                ):
                    tables.append(table)

        status = get_status_train_before()
        entities = get_list_entity()
        custom_entities = db.session.query(CustomOntology.name).all()
        custom_entities_list = [
            e.name for e in custom_entities if e.name is not None]
        result_list = list(set(entities) | set(custom_entities_list))
        list_tables = [
            {
                "id": t.id,
                "table_name": t.table_name,
                "entity": t.entity,
                "database": t.database.database_name
            } for t in tables
        ]

        return self.render_template(
            "superset/basic.html",
            bootstrap_data=json.dumps(
                {"list_tables": sorted(
                    list_tables, key=lambda d: d["table_name"]),
                    "entities": result_list, "status": status}),
            entry="mapping",
            title="Mapping entity")

    @has_access
    @expose("/api/tables/<id>", methods=["PUT"])
    def upadte_table(self, id):
        entity = request.form.get('entity')
        try:
            if entity is None:
                list_column = db.session.query(TableColumn).filter_by(
                    table_id=id).all()
                for elem in list_column:
                    db.session.query(
                        TableColumn).filter_by(
                        id=elem.id).update({"entity": None})
            db.session.query(
                SqlaTable).filter_by(id=id).update({"entity": entity})
            db.session.commit()
            return json.dumps({"status": True})
        except IntegrityError:
            return json.dumps({"status": False})

    @has_access
    @expose("/api/columns/<id>", methods=["PUT"])
    def update_column(self, id):
        entity = request.form.get('entity')
        try:
            db.session.query(
                TableColumn).filter_by(id=id).update({"entity": entity})
            db.session.commit()
            return json.dumps({"status": True})
        except IntegrityError:
            return json.dumps({"status": False})

    @has_access
    @expose("/api/<table_id>/columns")
    def get_columns(self, table_id):
        columns = db.session.query(TableColumn).filter_by(
            table_id=table_id).all()
        columns = [{
            "id": d.id,
            "column_name": d.column_name,
            "entity": d.entity} for d in columns]

        return json.dumps(
            {"columns": sorted(columns, key=lambda d: d["column_name"])}
        )

    @has_access
    @expose("/api/train", methods=["POST"])
    def train_rasa(self):
        r = train_mapping()
        if r.status_code != 200:
            return json.dumps("ERROR")

        data = r.json()
        return json.dumps(data["data"]["status"])

    @has_access
    @expose("/api/get-status-train")
    def get_status_train(self):
        status = get_status_train_process()
        return json.dumps(status)


class OauthLoginView(BaseSupersetView):
    """The login views for Superset!"""
    route_base = "/oauth"

    @expose("/google")
    def google(self):
        nextUrl = request.args.get('next', '/')
        session['nextUrl'] = nextUrl
        if not g.user.is_anonymous:
            return redirect("/")

        callback_url = app.config.get("SUPERSET_DOMAIN") \
                       + "/oauth/google/authorized"
        return google.authorize(callback=callback_url)

    @expose("/google/authorized")
    def google_authorized(self):
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

            hubspot_registration(user, route='/oauth/google')

        if user.login_count is None:
            user.login_count = 0
        user.login_count += 1
        user.last_login = datetime.datetime.now()
        db.session.commit()
        login_user(user)

        nextUrl = request.args.get('state') or '/'
        return redirect(nextUrl)

    @expose("/googlesheet/<email>")
    def login_googlesheet(self, email):
        from flask_jwt_extended import create_access_token
        from superset.tasks.schedules import _get_auth_cookies_by_email
        api_key_whitelist = app.config.get("API_KEY_WHITELIST")
        access_apikey = request.args.get("apikey")
        if not (access_apikey in api_key_whitelist):
            return json.dumps({"status": 401, "auth": False})

        user = security_manager.find_user(email=email)
        if user is None:
            m = re.match(r"(.+)@.+", email)
            name = m.group(1)
            role_beta = security_manager.find_role("Beta")
            user = security_manager.add_user(
                email, name, name,
                email, role_beta, str(uuid.uuid4())[:8]
            )
            hubspot_registration(user, route='/oauth/googlesheet')
            activate_trial(user.id)

        access_token = create_access_token(identity=user.id, fresh=True)
        return json.dumps({
            "status": 200,
            "access_token": access_token,
            "session": _get_auth_cookies_by_email(email)[0],
            "user": {
                "id": user.id,
                "username": user.username
            }
        })


class ArchiveOrganizationView(BaseSupersetView):
    route_base = "/archive-organization"

    @has_access
    @expose('/')
    def archiveOrgazination(self):
        # return self.render_template(
        #     "superset/archive_organization.html")
        return self.render_template(
            "superset/basic.html",
            bootstrap_data=json.dumps({}),
            entry="archiveOrganization",
            title="Archive Organization"
        )

    @expose('/check-password', methods=['POST'])
    def check_password(self):
        passwordhash = g.user.password
        password = request.form['password']
        result = check_password_hash(passwordhash, password)
        return json.dumps(result)


class ProfileView(BaseSupersetView):
    route_base = "/"

    @expose('/profile/me')
    def profile(self):
        username = g.user.username
        return redirect('/superset/profile/' + username)


class SettingsCustomView(BaseSupersetView):
    route_base = "/settings"

    @expose('/list')
    def list(self):
        return 'settings'


class TemplateManageView(BaseSupersetView):
    route_base = "/templates"

    @expose('/upload', methods=['POST'])
    def upload(self):
        file_name = request.form['file_name']
        nifi_host = app.config.get('NIFI_HOST')
        process_root_url = nifi_host + '/nifi-api/process-groups/root'
        process_root = requests.get(process_root_url)
        process_root_id = process_root.json()['component']['id']
        upload_template_url = "{}/nifi-api/process-groups/{}/templates/" \
                              "upload".format(nifi_host, process_root_id)
        file = {'template': open('/nifi-templates/{}'.format(file_name), 'rb')}
        requests.post(upload_template_url, files=file)
        return json.dumps(True)


class OntologyModelView(SupersetModelView):
    route_base = "/ontology"
    datamodel = SQLAInterface(modelsCustom.CustomOntology)

    list_title = _("Custom Ontology")

    label_columns = {
        'running': 'Status'
    }

    list_columns = [
        "name",
        "description",
        "synonyms"
    ]
    edit_columns = [
        "name",
        "description",
        "synonyms"
    ]
    add_columns = [
        "name",
        "description",
        "synonyms"
    ]
    order_columns = [""]


class TaskPolling(BaseSupersetView):
    route_base = "/"

    @expose("/<type_viz>/api/task/<task_id>")
    def polling_data_analytics(self, type_viz, task_id):
        tasks = {
            "anova": anova_task,
            "causal_inference": causal_inference_task,
            "classification": classification_task,
            "regression": regression_task,
            "timeseries": forecast_task,
            "tsne": clustering_task,
            "cleandata": data_imputation_task,
            "correlation": correlation_task,
            "sentiment": sentiment_task,
        }

        task = tasks.get(type_viz).AsyncResult(task_id)
        if task.state != "SUCCESS":
            data = {
                "classification": {
                    "status": task.state,
                },
                "regression": {
                    "status": task.state,
                },
                "timeseries": {
                    "status": task.state,
                },
                "tsne": {
                    "status": task.state,
                },
                "cleandata": {
                    "status": task.state,
                },
                "correlation": {
                    "status": task.state,
                },
                "sentiment": {
                    "status": task.state,
                },
                "causal_inference": {
                    "status": task.state,
                },
                "anova": {
                    "status": task.state,
                },
                "bayesian_regression": {
                    "status": task.state,
                }
            }

            return data.get(type_viz)

        return task.get()


class TaskApi(BaseApi):

    resource_name = "tasks"

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: str) -> Response:  # pylint: disable=arguments-differ
        from superset.extensions import celery_app
        celery_app.control.revoke(pk, terminate=True, signal="SIGTERM")
        return self.response(200, message="OK")


class BillingApi(BaseApi):

    resource_name = "billings"

    @expose("/available-time", methods=["GET"])
    @protect()
    @safe
    def get_avalable_time(self) -> Response:
        subscription = db.session.query(
            modelsCustom.BillingSubscription).filter(
            modelsCustom.BillingSubscription.user_id == g.user.get_id(),
            or_(
                modelsCustom.BillingSubscription.end_time.is_(None),
                modelsCustom.BillingSubscription.end_time >= datetime.datetime.now()
            )
        ).first()

        if not subscription:
            return self.response(400, message="Your subscription is either expired or unactivated.")

        product = [product for product in Stripe().get_products() \
                   if product.id==subscription.stripe_product_id] or None

        return self.response(
            200,
            available_time=subscription.billing_available_time,
            plan_name=product[0].name if product is not None else "Unknown"
        )
