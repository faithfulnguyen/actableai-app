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
import os

import wtforms_json
from flask import Flask, redirect, session, g
from flask_appbuilder import expose, IndexView
from flask_babel import gettext as __, lazy_gettext as _
from flask_compress import Compress
from flask_wtf import CSRFProtect

import simplejson as json
import pandas as pd
import numpy as np

from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import (
    _event_logger,
    APP_DIR,
    appbuilder,
    cache_manager,
    celery_app,
    db,
    feature_flag_manager,
    jinja_context_manager,
    manifest_processor,
    migrate,
    results_backend_manager,
    talisman,
    security_manager,
    google_oauth
)
from superset.security import SupersetSecurityManager
from superset.utils import CustomJSONEncoder
from superset.utils.core import pessimistic_connection_handling
from superset.utils.log import DBEventLogger, get_event_logger_from_cfg_value
from flask._compat import text_type
import flask_monitoringdashboard as dashboard
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from superset import app

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.json_encoder = CustomJSONEncoder

    try:
        # Allow user to override our config completely
        config_module = os.environ.get("SUPERSET_CONFIG", "superset.config")
        app.config.from_object(config_module)

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()
        if app.config.get('FLASK_MONITORING_DASHBOARD_ENABLE') == 'true':
            dashboard.config.init_from(envvar='FLASK_MONITORING_DASHBOARD_CONFIG')
            dashboard.bind(app)
        if app.config.get('SENTRY_ENABLE') == 'true' and app.config.get('SENTRY_FLASK_DSN'):
            env = os.environ.get("FLASK_ENV")
            sentry_logging = LoggingIntegration(
                level=logging.INFO,        # Capture info and above as breadcrumbs
                event_level=logging.ERROR  # Send errors as events
            )
            sentry_sdk.init(
                dsn=app.config.get('SENTRY_FLASK_DSN'),
                integrations=[FlaskIntegration(), sentry_logging],
                environment=env,
                # Set traces_sample_rate to 1.0 to capture 100%
                # of transactions for performance monitoring.
                # We recommend adjusting this value in production.
                traces_sample_rate=app.config.get('SENTRY_TRACES_SAMPLE_RATE'),
                send_default_pii=True, # if you use flask-login, user data (current user id, email address, username) is attached to the event.
                # By default the SDK will try to use the SENTRY_RELEASE
                # environment variable, or infer a git commit
                # SHA as release, however you may want to set
                # something more human-readable.
                # release="myapp@1.0.0",
            )
        return app

    # Make sure that bootstrap errors ALWAYS get logged
    except Exception as ex:
        logger.exception("Failed to create app")
        raise ex


class SupersetIndexView(IndexView):    
    def __init__(self, app: Flask) -> None:
        super().__init__()
        self.flask_app = app
        self.config = app.config

    @expose("/")
    def index(self):
        if g.user.is_anonymous:
            if self.config["ALLOW_GUEST_VIEW_PUBLIC_DATA"]:
                from superset.views.chart.views import SliceModelView
                slide = SliceModelView()
                slide.appbuilder=appbuilder
                return slide.list()
            else:
                return redirect("/login")
        role_access = ['Admin', 'Alpha', 'Gamma', 'Beta']
        if any(str(role) in role_access for role in g.user.roles):
            from superset.views.chart.views import SliceModelView
            slide = SliceModelView()
            slide.appbuilder=appbuilder
            return slide.list()
        return redirect('/superset/welcome')


class SupersetAppInitializer:
    def __init__(self, app: Flask) -> None:
        super().__init__()

        self.flask_app = app
        self.config = app.config
        self.manifest: dict = {}

    def pre_init(self) -> None:
        """
        Called before all other init tasks are complete
        """
        wtforms_json.init()

        if not os.path.exists(self.config["DATA_DIR"]):
            os.makedirs(self.config["DATA_DIR"])

    def post_init(self) -> None:
        """
        Called after any other init tasks
        """
        pass

    def configure_celery(self) -> None:
        celery_app.config_from_object(self.config["CELERY_CONFIG"])
        celery_app.set_default()
        flask_app = self.flask_app

        # Here, we want to ensure that every call into Celery task has an app context
        # setup properly
        task_base = celery_app.Task

        class AppContextTask(task_base):  # type: ignore
            # pylint: disable=too-few-public-methods
            abstract = True

            # Grab each call into the task and set up an app context
            def __call__(self, *args, **kwargs):
                with flask_app.app_context():
                    return task_base.__call__(self, *args, **kwargs)

        celery_app.Task = AppContextTask

    def init_views(self) -> None:
        #
        # We're doing local imports, as several of them import
        # models which in turn try to import
        # the global Flask app
        #
        # pylint: disable=too-many-locals
        # pylint: disable=too-many-statements
        from superset.connectors.druid.views import (
            DruidDatasourceModelView,
            DruidClusterModelView,
            DruidMetricInlineView,
            DruidColumnInlineView,
            Druid,
        )
        from superset.datasets.api import DatasetRestApi
        from superset.connectors.sqla.views import (
            TableColumnInlineView,
            SqlMetricInlineView,
            TableModelView,
            RowLevelSecurityFiltersModelView,
            CalculateColumnInlineView
        )
        from superset.views.annotations import (
            AnnotationLayerModelView,
            AnnotationModelView,
        )
        from superset.views.api import Api
        from superset.views.core import (
            AccessRequestsModelView,
            KV,
            R,
            Superset,
            CssTemplateModelView,
            CssTemplateAsyncModelView,
        )
        from superset.charts.api import ChartRestApi
        from superset.views.chart.views import SliceModelView, SliceAsync
        from superset.dashboards.api import DashboardRestApi
        from superset.views.dashboard.views import (
            DashboardModelView,
            Dashboard,
            DashboardModelViewAsync,
        )
        from superset.views.database.api import DatabaseRestApi
        from superset.views.database.views import DatabaseView, CsvToDatabaseView, ExcelToDatabaseView
        from superset.views.datasource import Datasource
        from superset.views.log.api import LogRestApi
        from superset.views.log.views import LogModelView
        from superset.views.schedules import (
            DashboardEmailScheduleView,
            SliceEmailScheduleView,
        )
        from superset.views.sql_lab import (
            QueryView,
            SavedQueryViewApi,
            SavedQueryView,
            TabStateView,
            TableSchemaView,
            SqlLab,
        )
        from superset.views.tags import TagView
        from superset.views.custom import (
            OverfitView,
            SapModelView,
            LinkedinModelView,
            OntologyModelView,
            MappingEntityView,
            OauthLoginView,
            ArchiveOrganizationView,
            ProfileView,
            SettingsCustomView,
            TemplateManageView,
            ActableConfigView,
            TaskPolling
        )
        from superset.billing.views import BillingView
        from superset.billing.utils import is_enabled_billing
        from superset.views.custom import TaskApi, BillingApi

        #
        # Setup API views
        #
        appbuilder.add_api(ChartRestApi)
        appbuilder.add_api(DashboardRestApi)
        appbuilder.add_api(DatabaseRestApi)
        appbuilder.add_api(DatasetRestApi)
        appbuilder.add_api(TaskApi)
        appbuilder.add_api(BillingApi)
        #
        # Setup regular views
        #
        # appbuilder.add_view(
        #     AnnotationLayerModelView,
        #     "Annotation Layers",
        #     label=__("Annotation Layers"),
        #     icon="fa-comment",
        #     category="Manage",
        #     category_label=__("Manage"),
        #     category_icon="",
        # )
        # appbuilder.add_view(
        #     AnnotationModelView,
        #     "Annotations",
        #     label=__("Annotations"),
        #     icon="fa-comments",
        #     category="Manage",
        #     category_label=__("Manage"),
        #     category_icon="",
        # )
        if self.config['DASHBOARD_FEATURE'] == 'true':
            appbuilder.add_view(
                DashboardModelView,
                "Dashboards",
                label=__("Dashboards"),
                icon="dashboard.svg",
                category="",
                category_icon="",
            )
            appbuilder.add_view_no_menu(Dashboard)
            appbuilder.add_view_no_menu(DashboardModelViewAsync)
        # appbuilder.add_view(
        #     CssTemplateModelView,
        #     "CSS Templates",
        #     label=__("CSS Templates"),
        #     icon="fa-css3",
        #     category="Manage",
        #     category_label=__("Manage"),
        #     category_icon="",
        # )
        # appbuilder.add_view(
        #     QueryView,
        #     "Queries",
        #     label=__("Queries"),
        #     category="Manage",
        #     category_label=__("Manage"),
        #     icon="fa-search",
        # )

        #
        # Setup views with no menu
        #
        appbuilder.add_view_no_menu(OverfitView)
        appbuilder.add_view_no_menu(Api)
        appbuilder.add_view_no_menu(CssTemplateAsyncModelView)
        appbuilder.add_view_no_menu(CsvToDatabaseView)
        appbuilder.add_view_no_menu(ExcelToDatabaseView)
        appbuilder.add_view_no_menu(Dashboard)
        appbuilder.add_view_no_menu(DashboardModelViewAsync)
        appbuilder.add_view_no_menu(Datasource)

        if feature_flag_manager.is_feature_enabled("KV_STORE"):
            appbuilder.add_view_no_menu(KV)

        appbuilder.add_view_no_menu(R)
        appbuilder.add_view_no_menu(SavedQueryView)
        appbuilder.add_view_no_menu(SavedQueryViewApi)
        appbuilder.add_view_no_menu(SliceAsync)
        appbuilder.add_view_no_menu(SqlLab)
        appbuilder.add_view_no_menu(SqlMetricInlineView)
        appbuilder.add_view_no_menu(Superset)
        appbuilder.add_view_no_menu(TableColumnInlineView)
        appbuilder.add_view_no_menu(TableModelView)
        appbuilder.add_view_no_menu(TableSchemaView)
        appbuilder.add_view_no_menu(TabStateView)
        appbuilder.add_view_no_menu(TagView)
        appbuilder.add_view_no_menu(MappingEntityView)
        appbuilder.add_view_no_menu(OauthLoginView)
        appbuilder.add_view_no_menu(ArchiveOrganizationView)
        appbuilder.add_view_no_menu(ProfileView)
        appbuilder.add_view_no_menu(TemplateManageView)
        appbuilder.add_view_no_menu(CalculateColumnInlineView)

        if is_enabled_billing():
            appbuilder.add_view_no_menu(BillingView)
        appbuilder.add_view_no_menu(ActableConfigView)
        appbuilder.add_view_no_menu(TaskPolling)

        appbuilder.add_view(
            SliceModelView,
            "Analytics",
            label=__("Analytics"),
            icon="analytics.svg",
            category="",
            category_icon="",
        )

        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            appbuilder.add_view_no_menu(TagView)

        # Under `Sources` category

        appbuilder.add_view(
            DatabaseView,
            "Databases",
            label=__("Databases"),
            icon="source.svg",
            category="Sources",
            category_label=__("Sources"),
            category_icon="source.svg",
        )
        appbuilder.add_link(
            "Tables",
            label=__("Tables"),
            href="/tablemodelview/list/",
            icon="fa-table",
            category="Sources",
            category_label=__("Sources"),
            category_icon="fa-table",
        )
        #
        # Add links
        #
        if self.config["ALLOWED_EXTENSIONS"] is not None:
            appbuilder.add_link(
                "Upload Data",
                label=__("Upload Data"),
                icon="fa-upload",
                category="Sources",
                category_label=__("Sources"),
                category_icon="fa-wrench",
                href="",
            )

        if self.config["CSV_EXTENSIONS"].intersection(
                self.config["ALLOWED_EXTENSIONS"]
        ):
            appbuilder.add_link(
                "Upload CSV",
                label=__("Upload CSV"),
                href="/csvtodatabaseview/form",
                icon="fa-upload",
                category="Upload Data",
                category_label=__("Upload Data"),
                category_icon="fa-wrench",
            )
        try:
            import xlrd  # pylint: disable=unused-import

            if self.config["EXCEL_EXTENSIONS"].intersection(
                    self.config["ALLOWED_EXTENSIONS"]
            ):
                appbuilder.add_link(
                    "Upload Excel",
                    label=__("Upload Excel"),
                    href="/exceltodatabaseview/form",
                    icon="fa-upload",
                    category="Upload Data",
                    category_label=__("Upload Data"),
                    category_icon="fa-wrench",
                )
        except ImportError as e:
            print(e)
            pass
        appbuilder.add_link(
            "SQL Editor",
            label=_("SQL"),
            href="/superset/sqllab",
            category_icon="fa-flask",
            icon="fa-flask",
            category="Sources",
            category_label=__("Sources"),
        )
        appbuilder.add_link(
            __("Saved Queries"),
            href="/sqllab/my_queries/",
            icon="fa-save",
            category="Sources",
            category_label=__("Sources"),
        )
        if self.config.get("FULFILLMENT_ENABLE") == 'true':
            appbuilder.add_link(
                "Mapping Entity",
                label=__("Mapping Entity"),
                href="/mappingentity",
                icon="fa-cloud-upload",
                category="Sources",
                category_label=__("Sources"),
                category_icon="fa-wrench",
            )

        appbuilder.add_link(
            "DataConnector",
            label=__("Data connectors"),
            icon="fa-cloud-upload",
            category="Sources",
            category_label=__("Sources"),
            category_icon="fa-wrench",
            href='',
        )

        if self.config['SAP_FEATURE'] == 'true':
            appbuilder.add_view(
                baseview=SapModelView,
                name='SAP',
                label=__("SAP"),
                category="DataConnector",
            )

        if self.config['LINKEDIN_FEATURE'] == 'true':
            appbuilder.add_view(
                baseview=LinkedinModelView,
                name='Linkedin',
                label=__("Linkedin"),
                category="DataConnector",
            )
        appbuilder.add_view(
            baseview=OntologyModelView,
            name='Ontology',
            label=__("Ontology"),
            category="",
        )

        # Setting Category

        appbuilder.add_view(
            baseview=SettingsCustomView,
            name="Settings",
            category="",
        )

        appbuilder.add_link(
            "Users",
            label=__("Users"),
            href="/users/list/",
            category="Settings"
        )

        appbuilder.add_link(
            "Roles",
            label=__("Roles"),
            href="/roles/list/",
            category="Settings"
        )

        appbuilder.add_link(
            "Profile",
            label=__("Profile"),
            href="/profile/me",
            category="Settings"
        )
        if is_enabled_billing():
            appbuilder.add_link(
                "BillingView",
                label=__("Billing"),
                href="/billing/",
                category="Settings"
            )

        appbuilder.add_link(
            "Archive Organization",
            label=__("Archive Organization"),
            href="#",
            category="Settings"
        )

        appbuilder.add_link(
            "ActableConfigView",
            label=__("System Configs"),
            href="/system-config/list/",
            category="Settings"
        )

        # Feedback link

        appbuilder.add_link(
            "Feedback",
            label=__("Feedback"),
            href="#",
            category="",
            icon="feed-back.svg",
        )

        # Use cases link

        if self.config['USECASES_FEATURE'] == 'true':
            appbuilder.add_link(
                "UseCases",
                label=__("UseCases"),
                href="#",
                category="",
                icon="usecases.svg",
            )

            appbuilder.add_link(
                "",
                label=__(""),
                href="#",
                icon="",
                category="UseCases",
                category_label=__("UseCases"),
                category_icon="usecases.svg",
            )

        # Docs link

        appbuilder.add_link(
            "How it work",
            label=__("How it work"),
            href="/docs/",
            icon="docs.svg",
            category="Docs",
            category_label=__("Docs"),
            category_icon="docs.svg",
        )

        appbuilder.add_link(
            "Correlation Analysis",
            label=__("Correlation Analysis"),
            href="https://overfit.nickelled.com/correlational_analysis?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Segmentation Analysis",
            label=__("Segmentation Analysis"),
            href="https://overfit.nickelled.com/segmentation_analysis?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Time Series Forecasting",
            label=__("Time Series Forecasting"),
            href="https://overfit.nickelled.com/time_series_forecasting?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Regression",
            label=__("Regression"),
            href="https://overfit.nickelled.com/regression?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Table",
            label=__("Table"),
            href="https://overfit.nickelled.com/table?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Database",
            label=__("Database"),
            href="https://overfit.nickelled.com/databases?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        appbuilder.add_link(
            "Login",
            label=__("Table"),
            href="https://overfit.nickelled.com/login?nclose=true",
            icon="fa-cloud-upload",
            category="WalkthroughTour",
            category_label=__("WalkthroughTour"),
            category_icon="fa-wrench",
        )

        # # Add links

        # appbuilder.add_link(
        #     "Import Dashboards",
        #     label=__("Import Dashboards"),
        #     href="/superset/import_dashboards",
        #     icon="fa-cloud-upload",
        #     category="Manage",
        #     category_label=__("Manage"),
        #     category_icon="fa-wrench",
        # )
        # appbuilder.add_link(
        #     "Query Search",
        #     label=_("Query Search"),
        #     href="/superset/sqllab#search",
        #     icon="fa-search",
        #     category_icon="fa-flask",
        #     category="SQL Lab",
        #     category_label=__("SQL Lab"),
        # )

        # # Conditionally setup log views

        # if (
        #     not self.config["FAB_ADD_SECURITY_VIEWS"] is False
        #     or self.config["SUPERSET_LOG_VIEW"] is False
        # ):
        #     appbuilder.add_api(LogRestApi)
        #     appbuilder.add_view(
        #         LogModelView,
        #         "Action Log",
        #         label=__("Action Log"),
        #         category="Security",
        #         category_label=__("Security"),
        #         icon="fa-list-ol",
        #     )

        # # Conditionally setup email views

        # if self.config["ENABLE_SCHEDULED_EMAIL_REPORTS"]:
        #     appbuilder.add_separator("Manage")
        #     appbuilder.add_view(
        #         DashboardEmailScheduleView,
        #         "Dashboard Email Schedules",
        #         label=__("Dashboard Emails"),
        #         category="Manage",
        #         category_label=__("Manage"),
        #         icon="fa-search",
        #     )
        #     appbuilder.add_view(
        #         SliceEmailScheduleView,
        #         "Chart Emails",
        #         label=__("Chart Email Schedules"),
        #         category="Manage",
        #         category_label=__("Manage"),
        #         icon="fa-search",
        #     )

        # # Conditionally add Access Request Model View

        # if self.config["ENABLE_ACCESS_REQUEST"]:
        #     appbuilder.add_view(
        #         AccessRequestsModelView,
        #         "Access requests",
        #         label=__("Access requests"),
        #         category="Security",
        #         category_label=__("Security"),
        #         icon="fa-table",
        #     )

        # # Conditionally setup Druid Views

        # if self.config["DRUID_IS_ACTIVE"]:
        #     appbuilder.add_separator("Sources")
        #     appbuilder.add_view(
        #         DruidDatasourceModelView,
        #         "Druid Datasources",
        #         label=__("Druid Datasources"),
        #         category="Sources",
        #         category_label=__("Sources"),
        #         icon="fa-cube",
        #     )
        #     appbuilder.add_view(
        #         DruidClusterModelView,
        #         name="Druid Clusters",
        #         label=__("Druid Clusters"),
        #         icon="fa-cubes",
        #         category="Sources",
        #         category_label=__("Sources"),
        #         category_icon="fa-database",
        #     )
        #     appbuilder.add_view_no_menu(DruidMetricInlineView)
        #     appbuilder.add_view_no_menu(DruidColumnInlineView)
        #     appbuilder.add_view_no_menu(Druid)
        #     appbuilder.add_link(
        #         "Scan New Datasources",
        #         label=__("Scan New Datasources"),
        #         href="/druid/scan_new_datasources/",
        #         category="Sources",
        #         category_label=__("Sources"),
        #         category_icon="fa-database",
        #         icon="fa-refresh",
        #     )
        #     appbuilder.add_link(
        #         "Refresh Druid Metadata",
        #         label=__("Refresh Druid Metadata"),
        #         href="/druid/refresh_datasources/",
        #         category="Sources",
        #         category_label=__("Sources"),
        #         category_icon="fa-database",
        #         icon="fa-cog",
        #     )
        #     appbuilder.add_separator("Sources")

    def init_app_in_ctx(self) -> None:
        """
        Runs init logic in the context of the app
        """
        self.configure_feature_flags()
        self.configure_fab()
        self.configure_url_map_converters()
        self.configure_data_sources()

        # Hook that provides administrators a handle on the Flask APP
        # after initialization
        flask_app_mutator = self.config["FLASK_APP_MUTATOR"]
        if flask_app_mutator:
            flask_app_mutator(self.flask_app)

        self.init_views()

    def init_app(self) -> None:
        """
        Main entry point which will delegate to other methods in
        order to fully init the app
        """
        self.pre_init()

        self.setup_db()

        self.configure_celery()

        self.setup_event_logger()

        self.setup_bundle_manifest()

        self.register_blueprints()

        self.configure_wtf()

        self.configure_logging()

        self.configure_middlewares()

        self.configure_cache()

        self.configure_jinja_context()

        with self.flask_app.app_context():
            self.init_app_in_ctx()
            self.configure_sm()

        self.post_init()

        self.configure_mindsdb()

    def setup_event_logger(self):
        _event_logger["event_logger"] = get_event_logger_from_cfg_value(
            self.flask_app.config.get("EVENT_LOGGER", DBEventLogger())
        )

    def configure_data_sources(self):
        # Registering sources
        module_datasource_map = self.config["DEFAULT_MODULE_DS_MAP"]
        module_datasource_map.update(self.config["ADDITIONAL_MODULE_DS_MAP"])
        ConnectorRegistry.register_sources(module_datasource_map)

    def configure_cache(self):
        cache_manager.init_app(self.flask_app)
        results_backend_manager.init_app(self.flask_app)

    def configure_feature_flags(self):
        feature_flag_manager.init_app(self.flask_app)

    def configure_fab(self):
        if self.config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        custom_sm = self.config["CUSTOM_SECURITY_MANAGER"] or SupersetSecurityManager
        if not issubclass(custom_sm, SupersetSecurityManager):
            raise Exception(
                """Your CUSTOM_SECURITY_MANAGER must now extend SupersetSecurityManager,
                 not FAB's security manager.
                 See [4565] in UPDATING.md"""
            )

        appbuilder.indexview = SupersetIndexView(self)
        appbuilder.base_template = "superset/base.html"
        appbuilder.security_manager_class = custom_sm
        appbuilder.update_perms = False
        appbuilder.init_app(self.flask_app, db.session)

    def configure_url_map_converters(self):
        #
        # Doing local imports here as model importing causes a reference to
        # app.config to be invoked and we need the current_app to have been setup
        #
        from superset.utils.url_map_converters import RegexConverter
        from superset.utils.url_map_converters import ObjectTypeConverter

        self.flask_app.url_map.converters["regex"] = RegexConverter
        self.flask_app.url_map.converters["object_type"] = ObjectTypeConverter

    def configure_jinja_context(self):
        jinja_context_manager.init_app(self.flask_app)

    def configure_middlewares(self):
        if self.config["ENABLE_CORS"]:
            from flask_cors import CORS

            CORS(self.flask_app, **self.config["CORS_OPTIONS"])

        if self.config["ENABLE_PROXY_FIX"]:
            from werkzeug.middleware.proxy_fix import ProxyFix

            self.flask_app.wsgi_app = ProxyFix(
                self.flask_app.wsgi_app, **self.config["PROXY_FIX_CONFIG"]
            )

        if self.config["ENABLE_CHUNK_ENCODING"]:

            class ChunkedEncodingFix:  # pylint: disable=too-few-public-methods
                def __init__(self, app):
                    self.app = app

                def __call__(self, environ, start_response):
                    # Setting wsgi.input_terminated tells werkzeug.wsgi to ignore
                    # content-length and read the stream till the end.
                    if environ.get("HTTP_TRANSFER_ENCODING", "").lower() == "chunked":
                        environ["wsgi.input_terminated"] = True
                    return self.app(environ, start_response)

            self.flask_app.wsgi_app = ChunkedEncodingFix(self.flask_app.wsgi_app)

        if self.config["UPLOAD_FOLDER"]:
            try:
                os.makedirs(self.config["UPLOAD_FOLDER"])
            except OSError:
                pass

        for middleware in self.config["ADDITIONAL_MIDDLEWARE"]:
            self.flask_app.wsgi_app = middleware(self.flask_app.wsgi_app)

        # Flask-Compress
        if self.config["ENABLE_FLASK_COMPRESS"]:
            Compress(self.flask_app)

        if self.config["TALISMAN_ENABLED"]:
            talisman.init_app(self.flask_app, **self.config["TALISMAN_CONFIG"])

    def configure_logging(self):
        self.config["LOGGING_CONFIGURATOR"].configure_logging(
            self.config, self.flask_app.debug
        )

    def setup_db(self):
        db.init_app(self.flask_app)

        with self.flask_app.app_context():
            pessimistic_connection_handling(db.engine)

        migrate.init_app(self.flask_app, db=db, directory=APP_DIR + "/migrations")

    def configure_wtf(self):
        if self.config["WTF_CSRF_ENABLED"]:
            csrf = CSRFProtect(self.flask_app)
            csrf_exempt_list = self.config["WTF_CSRF_EXEMPT_LIST"]
            for ex in csrf_exempt_list:
                csrf.exempt(ex)

    def register_blueprints(self):
        for bp in self.config["BLUEPRINTS"]:
            try:
                logger.info(f"Registering blueprint: '{bp.name}'")
                self.flask_app.register_blueprint(bp)
            except Exception:  # pylint: disable=broad-except
                logger.exception("blueprint registration failed")

    def setup_bundle_manifest(self):
        manifest_processor.init_app(self.flask_app)

    def configure_sm(self):
        login_manager = security_manager.lm
        @login_manager.request_loader
        def load_user_from_request(request):
            if (
                (
                    "*" in self.config.get("IP_WISHLIST", ["*"])
                    or request.remote_addr in self.config.get("IP_WISHLIST", ["*"])
                ) and "Author-Email" in request.headers.keys()
            ):
                from flask_appbuilder.security.sqla.models import User
                user = db.session.query(User).filter_by(
                    email=request.headers["Author-Email"]).first()
                if user:
                    return user

            return None

        google_oauth.init_app(self.flask_app)
        google = google_oauth.google

        @google.tokengetter
        def get_google_oauth_token():
            return session.get('google_token')

    def configure_mindsdb(self):
        os.environ['MINDSDB_STORAGE_PATH'] = self.config.get("MINDSDB_STORAGE_PATH")
