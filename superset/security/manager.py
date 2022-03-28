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
# pylint: disable=C,R,W
"""A set of constants and methods to manage permissions and security"""
import logging
from typing import Any, Callable, List, Optional, Set, Tuple, TYPE_CHECKING, Union
from typing_extensions import Self

from flask import current_app, g
from flask_appbuilder import Model
from flask_appbuilder.security.sqla import models as ab_models
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import (
    assoc_permissionview_role,
    assoc_user_role,
)
from flask_appbuilder.security.views import (
    PermissionModelView,
    PermissionViewModelView,
    RoleModelView,
    UserModelView,
    ViewMenuModelView,
)
from flask_appbuilder.widgets import ListWidget
from sqlalchemy import or_
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm.mapper import Mapper

from superset import sql_parse
from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import RouteMethod
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.utils.core import DatasourceName, get_example_database
from .views import CustomUserDBModelView, CustomRegisterUserDBView, MyUser


if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.connectors.base.models import BaseDatasource
    from superset.models.core import Database
    from superset.viz import BaseViz
    from superset.connectors.sqla.models import SqlaTable
logger = logging.getLogger(__name__)


class SupersetSecurityListWidget(ListWidget):
    """
        Redeclaring to avoid circular imports
    """

    template = "superset/fab_overrides/list.html"


class SupersetRoleListWidget(ListWidget):
    """
        Role model view from FAB already uses a custom list widget override
        So we override the override
    """

    template = "superset/fab_overrides/list_role.html"

    def __init__(self, **kwargs):
        kwargs["appbuilder"] = current_app.appbuilder
        super().__init__(**kwargs)


UserModelView.list_widget = SupersetSecurityListWidget
RoleModelView.list_widget = SupersetRoleListWidget
PermissionViewModelView.list_widget = SupersetSecurityListWidget
PermissionModelView.list_widget = SupersetSecurityListWidget

# Limiting routes on FAB model views
UserModelView.include_route_methods = RouteMethod.CRUD_SET | {
    RouteMethod.ACTION,
    RouteMethod.API_READ,
    RouteMethod.ACTION_POST,
    "userinfo",
}
UserModelView.search_columns = ('username', 'first_name', 'last_name')
RoleModelView.include_route_methods = RouteMethod.CRUD_SET
RoleModelView.search_columns = ('name', 'permissions')
PermissionViewModelView.include_route_methods = {RouteMethod.LIST}
PermissionModelView.include_route_methods = {RouteMethod.LIST}
ViewMenuModelView.include_route_methods = {RouteMethod.LIST}


class SupersetSecurityManager(SecurityManager):
    READ_ONLY_MODEL_VIEWS = {"DatabaseAsync", "DatabaseView", "DruidClusterModelView"}

    USER_MODEL_VIEWS = {
        "UserDBModelView",
        "UserLDAPModelView",
        "UserOAuthModelView",
        "UserOIDModelView",
        "UserRemoteUserModelView",
    }

    GAMMA_READ_ONLY_MODEL_VIEWS = {
        "SqlMetricInlineView",
        "TableColumnInlineView",
        "TableModelView",
        "DruidColumnInlineView",
        "DruidDatasourceModelView",
        "DruidMetricInlineView",
        "Datasource",
    } | READ_ONLY_MODEL_VIEWS

    ADMIN_ONLY_VIEW_MENUS = {
        "AccessRequestsModelView",
        "Manage",
        "SQL Lab",
        "Queries",
        "Refresh Druid Metadata",
        "ResetPasswordView",
        "RoleModelView",
        "LogModelView",
        "Security",
        "Roles",
        "Users",
        "Archive Organization",
        "RowLevelSecurityFiltersModelView",
        "ActableConfigView",
    } | USER_MODEL_VIEWS

    ALPHA_ONLY_VIEW_MENUS = {"Upload a CSV"}

    ADMIN_ONLY_PERMISSIONS = {
        "can_sql_json",  # TODO: move can_sql_json to sql_lab role
        "can_override_role_permissions",
        "can_sync_druid_source",
        "can_override_role_permissions",
        "can_approve",
        "can_update_role",
        "all_query_access",
    }

    READ_ONLY_PERMISSION = {"can_show", "can_list", "can_get", "can_external_metadata"}

    ALPHA_ONLY_PERMISSIONS = {
        "muldelete",
        "all_database_access",
        "all_datasource_access",
    }

    OBJECT_SPEC_PERMISSIONS = {
        "database_access",
        "schema_access",
        "datasource_access",
        "metric_access",
    }

    ACCESSIBLE_PERMS = {"can_userinfo"}

    def get_schema_perm(
        self, database: Union["Database", str], schema: Optional[str] = None
    ) -> Optional[str]:
        """
        Return the database specific schema permission.

        :param database: The Superset database or database name
        :param schema: The Superset schema name
        :return: The database specific schema permission
        """

        if schema:
            return f"[{database}].[{schema}]"

        return None

    def unpack_schema_perm(self, schema_permission: str) -> Tuple[str, str]:
        # [database_name].[schema_name]
        schema_name = schema_permission.split(".")[1][1:-1]
        database_name = schema_permission.split(".")[0][1:-1]
        return database_name, schema_name

    def can_access(self, permission_name: str, view_name: str) -> bool:
        """
        Return True if the user can access the FAB permission/view, False
        otherwise.

        Note this method adds protection from has_access failing from missing
        permission/view entries.

        :param permission_name: The FAB permission name
        :param view_name: The FAB view-menu name
        :returns: Whether the use can access the FAB permission/view
        """
        user = g.user
        if user.is_anonymous:
            return self.is_item_public(permission_name, view_name)
        return self._has_view_access(user, permission_name, view_name)

    def can_access_all_queries(self) -> bool:
        """
        Return True if the user can access all queries, False otherwise.

        :returns: Whether the user can access all queries
        """
        return self.can_access("all_query_access", "all_query_access")

    def can_access_all_datasources(self) -> bool:
        """
        Return True if the user can fully access all the Superset datasources, False
        otherwise.
        :returns: Whether the user can fully access all Superset datasources
        """

        return self.can_access("all_datasource_access", "all_datasource_access")

    def can_access_all_databases(self) -> bool:
        """
        Return True if the user can fully access all the Superset databases, False
        otherwise.
        :returns: Whether the user can fully access all Superset databases
        """

        return self.can_access("all_database_access", "all_database_access")

    def can_access_database(self, database: Union["Database", "DruidCluster"]) -> bool:
        """
        Return True if the user can fully access the Superset database, False otherwise.
        Note for Druid the database is akin to the Druid cluster.
        :param database: The Superset database
        :returns: Whether the user can fully access the Superset database
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_all_databases()
            or self.can_access("database_access", database.perm)  # type: ignore
        )

    def can_access_schema(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can fully access the schema associated with the Superset
        datasource, False otherwise.
        Note for Druid datasources the database and schema are akin to the Druid cluster
        and datasource name prefix respectively, i.e., [schema.]datasource.
        :param datasource: The Superset datasource
        :returns: Whether the user can fully access the datasource's schema
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_database(datasource.database)
            or self.can_access("schema_access", datasource.schema_perm or "")
        )

    def can_access_datasource(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can fully access of the Superset datasource, False
        otherwise.
        :param datasource: The Superset datasource
        :returns: Whether the user can fully access the Superset datasource
        """

        try:
            self.raise_for_access(datasource=datasource)
        except SupersetSecurityException:
            return False

        return True

    @staticmethod
    def get_datasource_access_error_msg(datasource: "BaseDatasource") -> str:
        """
        Return the error message for the denied Superset datasource.
        :param datasource: The denied Superset datasource
        :returns: The error message
        """

        return f"""This endpoint requires the datasource {datasource.name}, database or
            `all_datasource_access` permission"""

    @staticmethod
    def get_datasource_access_link(  # pylint: disable=unused-argument
        datasource: "BaseDatasource",
    ) -> Optional[str]:
        """
        Return the link for the denied Superset datasource.
        :param datasource: The denied Superset datasource
        :returns: The access URL
        """

        from superset import conf

        return conf.get("PERMISSION_INSTRUCTIONS_LINK")

    def get_datasource_access_error_object(  # pylint: disable=invalid-name
        self, datasource: "BaseDatasource"
    ) -> SupersetError:
        """
        Return the error object for the denied Superset datasource.
        :param datasource: The denied Superset datasource
        :returns: The error object
        """
        return SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message=self.get_datasource_access_error_msg(datasource),
            level=ErrorLevel.ERROR,
            extra={
                "link": self.get_datasource_access_link(datasource),
                "datasource": datasource.name,
            },
        )

    def get_table_access_error_msg(self, tables: List[str]) -> str:
        """
        Return the error message for the denied SQL tables.

        Note the table names conform to the [[cluster.]schema.]table construct.

        :param tables: The list of denied SQL table names
        :returns: The error message
        """
        quoted_tables = [f"`{t}`" for t in tables]
        return f"""You need access to the following tables: {", ".join(quoted_tables)},
            `all_database_access` or `all_datasource_access` permission"""

    def get_table_access_error_object(self, tables: Set["Table"]) -> SupersetError:
        """
        Return the error object for the denied SQL tables.
        :param tables: The set of denied SQL tables
        :returns: The error object
        """
        return SupersetError(
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            message=self.get_table_access_error_msg(tables),
            level=ErrorLevel.ERROR,
            extra={
                "link": self.get_table_access_link(tables),
                "tables": [str(table) for table in tables],
            },
        )

    def get_table_access_link(self, tables: List[str]) -> Optional[str]:
        """
        Return the access link for the denied SQL tables.

        Note the table names conform to the [[cluster.]schema.]table construct.

        :param tables: The list of denied SQL table names
        :returns: The access URL
        """

        from superset import conf

        return conf.get("PERMISSION_INSTRUCTIONS_LINK")

    def _datasource_access_by_name(
        self, database: "Database", table_name: str, schema: Optional[str] = None
    ) -> bool:
        """
        Return True if the user can access the SQL table, False otherwise.

        :param database: The SQL database
        :param table_name: The SQL table name
        :param schema: The Superset schema
        :returns: Whether the use can access the SQL table
        """

        from superset import db

        if self.can_access_database(database) or self.can_access_all_datasources():
            return True

        schema_perm = self.get_schema_perm(database, schema)
        if schema_perm and self.can_access("schema_access", schema_perm):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, table_name, schema=schema
        )
        for datasource in datasources:
            if self.can_access("datasource_access", datasource.perm):
                return True
        return False

    def _get_schema_and_table(
        self, table_in_query: str, schema: str
    ) -> Tuple[str, str]:
        """
        Return the SQL schema/table tuple associated with the table extracted from the
        SQL query.

        Note the table name conforms to the [[cluster.]schema.]table construct.

        :param table_in_query: The SQL table name
        :param schema: The fallback SQL schema if not present in the table name
        :returns: The SQL schema/table tuple
        """

        table_name_pieces = table_in_query.split(".")
        if len(table_name_pieces) == 3:
            return tuple(table_name_pieces[1:])  # type: ignore
        elif len(table_name_pieces) == 2:
            return tuple(table_name_pieces)  # type: ignore
        return (schema, table_name_pieces[0])

    def _datasource_access_by_fullname(
        self, database: "Database", table_in_query: str, schema: str
    ) -> bool:
        """
        Return True if the user can access the table extracted from the SQL query, False
        otherwise.

        Note the table name conforms to the [[cluster.]schema.]table construct.

        :param database: The Superset database
        :param table_in_query: The SQL table name
        :param schema: The fallback SQL schema, i.e., if not present in the table name
        :returns: Whether the user can access the SQL table
        """

        table_schema, table_name = self._get_schema_and_table(table_in_query, schema)
        return self._datasource_access_by_name(
            database, table_name, schema=table_schema
        )

    def rejected_tables(self, sql: str, database: "Database", schema: str) -> List[str]:
        """
        Return the list of rejected SQL table names.

        Note the rejected table names conform to the [[cluster.]schema.]table construct.

        :param sql: The SQL statement
        :param database: The SQL database
        :param schema: The SQL database schema
        :returns: The rejected table names
        """

        superset_query = sql_parse.ParsedQuery(sql)

        return [
            t
            for t in superset_query.tables
            if not self._datasource_access_by_fullname(database, t, schema)
        ]

    def get_public_role(self) -> Optional[Any]:  # Optional[self.role_model]
        from superset import conf

        if not conf.get("PUBLIC_ROLE_LIKE_GAMMA", False):
            return None

        from superset import db

        return db.session.query(self.role_model).filter_by(name="Public").first()

    def user_view_menu_names(self, permission_name: str) -> Set[str]:
        from superset import db

        base_query = (
            db.session.query(self.viewmenu_model.name)
            .join(self.permissionview_model)
            .join(self.permission_model)
            .join(assoc_permissionview_role)
            .join(self.role_model)
        )

        if not g.user.is_anonymous:
            # filter by user id
            view_menu_names = (
                base_query.join(assoc_user_role)
                .join(self.user_model)
                .filter(self.user_model.id == g.user.id)
                .filter(self.permission_model.name == permission_name)
            ).all()
            return set([s.name for s in view_menu_names])

        # Properly treat anonymous user
        public_role = self.get_public_role()
        if public_role:
            # filter by public role
            view_menu_names = (
                base_query.filter(self.role_model.id == public_role.id).filter(
                    self.permission_model.name == permission_name
                )
            ).all()
            return set([s.name for s in view_menu_names])
        return set()

    def schemas_accessible_by_user(
        self, database: "Database", schemas: List[str], hierarchical: bool = True
    ) -> List[str]:
        """
        Return the sorted list of SQL schemas accessible by the user.

        :param database: The SQL database
        :param schemas: The list of eligible SQL schemas
        :param hierarchical: Whether to check using the hierarchical permission logic
        :returns: The list of accessible SQL schemas
        """

        from superset import db
        from superset.connectors.sqla.models import SqlaTable

        if hierarchical and (
            self.can_access_database(database) or self.can_access_all_datasources()
        ):
            return schemas

        # schema_access
        accessible_schemas = {
            self.unpack_schema_perm(s)[1]
            for s in self.user_view_menu_names("schema_access")
            if s.startswith(f"[{database}].")
        }

        # datasource_access
        perms = self.user_view_menu_names("datasource_access")
        if perms:
            tables = (
                db.session.query(SqlaTable.schema)
                .filter(SqlaTable.database_id == database.id)
                .filter(SqlaTable.schema.isnot(None))
                .filter(SqlaTable.schema != "")
                .filter(or_(SqlaTable.perm.in_(perms)))
                .distinct()
            )
            accessible_schemas.update([t.schema for t in tables])

        return [s for s in schemas if s in accessible_schemas]

    def get_datasources_accessible_by_user(
        self,
        database: "Database",
        datasource_names: List[DatasourceName],
        schema: Optional[str] = None,
    ) -> List[DatasourceName]:
        """
        Return the list of SQL tables accessible by the user.

        :param database: The SQL database
        :param datasource_names: The list of eligible SQL tables w/ schema
        :param schema: The fallback SQL schema if not present in the table name
        :returns: The list of accessible SQL tables w/ schema
        """

        from superset import db

        if self.database_access_owned(database) or self.can_access_all_datasources():
            return datasource_names

        if schema:
            schema_perm = self.get_schema_perm(database, schema)
            if schema_perm and self.can_access("schema_access", schema_perm):
                return datasource_names

        user_perms = self.user_view_menu_names("datasource_access")
        schema_perms = self.user_view_menu_names("schema_access")
        user_datasources = ConnectorRegistry.query_datasources_by_permissions(
            db.session, database, user_perms, schema_perms
        )
        if schema:
            names = {d.table_name for d in user_datasources if d.table_name in [dn.table for dn in datasource_names]}
            return [d for d in datasource_names if d.table in names]
        else:
            full_names = {d.full_name for d in user_datasources}
            return [d for d in datasource_names if f"[{database}].[{d}]" in full_names]

    def merge_perm(self, permission_name: str, view_menu_name: str) -> None:
        """
        Add the FAB permission/view-menu.

        :param permission_name: The FAB permission name
        :param view_menu_names: The FAB view-menu name
        :see: SecurityManager.add_permission_view_menu
        """

        logger.warning(
            "This method 'merge_perm' is deprecated use add_permission_view_menu"
        )
        self.add_permission_view_menu(permission_name, view_menu_name)

    def _is_user_defined_permission(self, perm: Model) -> bool:
        """
        Return True if the FAB permission is user defined, False otherwise.

        :param perm: The FAB permission
        :returns: Whether the FAB permission is user defined
        """

        return perm.permission.name in self.OBJECT_SPEC_PERMISSIONS

    def create_custom_permissions(self) -> None:
        """
        Create custom FAB permissions.
        """
        self.add_permission_view_menu("all_datasource_access", "all_datasource_access")
        self.add_permission_view_menu("all_database_access", "all_database_access")
        self.add_permission_view_menu("all_query_access", "all_query_access")

    def create_missing_perms(self) -> None:
        """
        Creates missing FAB permissions for datasources, schemas and metrics.
        """

        from superset import db
        from superset.connectors.base.models import BaseMetric
        from superset.models import core as models

        logger.info("Fetching a set of all perms to lookup which ones are missing")
        all_pvs = set()
        for pv in self.get_session.query(self.permissionview_model).all():
            if pv.permission and pv.view_menu:
                all_pvs.add((pv.permission.name, pv.view_menu.name))

        def merge_pv(view_menu, perm):
            """Create permission view menu only if it doesn't exist"""
            if view_menu and perm and (view_menu, perm) not in all_pvs:
                self.add_permission_view_menu(view_menu, perm)

        logger.info("Creating missing datasource permissions.")
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        for datasource in datasources:
            merge_pv("datasource_access", datasource.get_perm())
            merge_pv("schema_access", datasource.get_schema_perm())

        logger.info("Creating missing database permissions.")
        databases = db.session.query(models.Database).all()
        for database in databases:
            merge_pv("database_access", database.perm)

        logger.info("Creating missing metrics permissions")
        metrics: List[BaseMetric] = []
        for datasource_class in ConnectorRegistry.sources.values():
            metrics += list(db.session.query(datasource_class.metric_class).all())

    def clean_perms(self) -> None:
        """
        Clean up the FAB faulty permissions.
        """

        logger.info("Cleaning faulty perms")
        sesh = self.get_session
        pvms = sesh.query(ab_models.PermissionView).filter(
            or_(
                ab_models.PermissionView.permission == None,
                ab_models.PermissionView.view_menu == None,
            )
        )
        deleted_count = pvms.delete()
        sesh.commit()
        if deleted_count:
            logger.info("Deleted {} faulty permissions".format(deleted_count))

    def sync_role_definitions(self) -> None:
        """
        Initialize the Superset application with security roles and such.
        """

        from superset import conf

        logger.info("Syncing role definition")

        self.create_custom_permissions()

        # Creating default roles
        self.set_role("Admin", self._is_admin_pvm)
        self.set_role("Alpha", self._is_alpha_pvm)
        self.set_role("Gamma", self._is_gamma_pvm)
        self.set_role("granter", self._is_granter_pvm)
        self.set_role("sql_lab", self._is_sql_lab_pvm)

        if conf.get("PUBLIC_ROLE_LIKE_GAMMA", False):
            self.set_role("Public", self._is_gamma_pvm)

        self.create_missing_perms()

        # commit role and view menu updates
        self.get_session.commit()
        self.clean_perms()

    def set_role(self, role_name: str, pvm_check: Callable) -> None:
        """
        Set the FAB permission/views for the role.

        :param role_name: The FAB role name
        :param pvm_check: The FAB permission/view check
        """

        logger.info("Syncing {} perms".format(role_name))
        sesh = self.get_session
        pvms = sesh.query(ab_models.PermissionView).all()
        pvms = [p for p in pvms if p.permission and p.view_menu]
        role = self.add_role(role_name)
        role_pvms = [p for p in pvms if pvm_check(p)]
        role.permissions = role_pvms
        sesh.merge(role)
        sesh.commit()

    def _is_admin_only(self, pvm: Model) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Admin users,
        False otherwise.

        Note readonly operations on read only model views are allowed only for admins.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Admin users
        """

        if (
            pvm.view_menu.name in self.READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.ADMIN_ONLY_VIEW_MENUS
            or pvm.permission.name in self.ADMIN_ONLY_PERMISSIONS
        )

    def _is_alpha_only(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Alpha users,
        False otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Alpha users
        """

        if (
            pvm.view_menu.name in self.GAMMA_READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.ALPHA_ONLY_VIEW_MENUS
            or pvm.permission.name in self.ALPHA_ONLY_PERMISSIONS
        )

    def _is_accessible_to_all(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to all, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to all users
        """

        return pvm.permission.name in self.ACCESSIBLE_PERMS

    def _is_admin_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Admin user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Admin related
        """

        return not self._is_user_defined_permission(pvm)

    def _is_alpha_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Alpha user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Alpha related
        """

        return not (
            self._is_user_defined_permission(pvm) or self._is_admin_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_gamma_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Gamma user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Gamma related
        """
        return not (
            self._is_user_defined_permission(pvm)
            or self._is_admin_only(pvm)
            or self._is_alpha_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_sql_lab_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is SQL Lab related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is SQL Lab related
        """

        return (
            pvm.view_menu.name
            in {"SQL Lab", "SQL Editor", "Query Search", "Saved Queries"}
            or pvm.permission.name
            in {
                "can_sql_json",
                "can_csv",
                "can_search_queries",
                "can_sqllab_viz",
                "can_sqllab",
            }
            or (
                pvm.view_menu.name in self.USER_MODEL_VIEWS
                and pvm.permission.name == "can_list"
            )
        )

    def _is_granter_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the user can grant the FAB permission/view, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the user can grant the FAB permission/view
        """

        return pvm.permission.name in {"can_override_role_permissions", "can_approve"}

    def set_perm(
        self, mapper: Mapper, connection: Connection, target: "BaseDatasource"
    ) -> None:
        """
        Set the datasource permissions.

        :param mapper: The table mappper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """
        link_table = target.__table__  # pylint: disable=no-member
        if target.perm != target.get_perm():
            connection.execute(
                link_table.update()
                .where(link_table.c.id == target.id)
                .values(perm=target.get_perm())
            )

        if (
            hasattr(target, "schema_perm")
            and target.schema_perm != target.get_schema_perm()
        ):
            connection.execute(
                link_table.update()
                .where(link_table.c.id == target.id)
                .values(schema_perm=target.get_schema_perm())
            )

        pvm_names = []
        if target.__tablename__ in {"dbs", "clusters"}:
            pvm_names.append(("database_access", target.get_perm()))
        else:
            pvm_names.append(("datasource_access", target.get_perm()))
            if target.schema:
                pvm_names.append(("schema_access", target.get_schema_perm()))

        # TODO(bogdan): modify slice permissions as well.
        for permission_name, view_menu_name in pvm_names:
            permission = self.find_permission(permission_name)
            view_menu = self.find_view_menu(view_menu_name)
            pv = None

            if not permission:
                permission_table = (
                    self.permission_model.__table__  # pylint: disable=no-member
                )
                connection.execute(
                    permission_table.insert().values(name=permission_name)
                )
                permission = self.find_permission(permission_name)
            if not view_menu:
                view_menu_table = (
                    self.viewmenu_model.__table__  # pylint: disable=no-member
                )
                connection.execute(view_menu_table.insert().values(name=view_menu_name))
                view_menu = self.find_view_menu(view_menu_name)

            if permission and view_menu:
                pv = (
                    self.get_session.query(self.permissionview_model)
                    .filter_by(permission=permission, view_menu=view_menu)
                    .first()
                )
            if not pv and permission and view_menu:
                permission_view_table = (
                    self.permissionview_model.__table__  # pylint: disable=no-member
                )
                connection.execute(
                    permission_view_table.insert().values(
                        permission_id=permission.id, view_menu_id=view_menu.id
                    )
                )

    def assert_datasource_permission(self, datasource: "BaseDatasource") -> None:
        """
        Assert the the user has permission to access the Superset datasource.

        :param datasource: The Superset datasource
        :raises SupersetSecurityException: If the user does not have permission
        """

        if not self.can_access_datasource(datasource):
            raise SupersetSecurityException(
                self.get_datasource_access_error_msg(datasource),
                self.get_datasource_access_link(datasource),
            )

    def assert_query_context_permission(self, query_context: "QueryContext") -> None:
        """
        Assert the the user has permission to access the query context.

        :param query_context: The query context
        :raises SupersetSecurityException: If the user does not have permission
        """

        self.assert_datasource_permission(query_context.datasource)

    def assert_viz_permission(self, viz: "BaseViz") -> None:
        """
        Assert the the user has permission to access the visualization.

        :param viz: The visualization
        :raises SupersetSecurityException: If the user does not have permission
        """

        self.assert_datasource_permission(viz.datasource)

    def raise_for_access(  # pylint: disable=too-many-arguments,too-many-branches
        self,
        database: Optional["Database"] = None,
        datasource: Optional["BaseDatasource"] = None,
        query: Optional["Query"] = None,
        query_context: Optional["QueryContext"] = None,
        table: Optional["Table"] = None,
        viz: Optional["BaseViz"] = None,
    ) -> None:
        """
        Raise an exception if the user cannot access the resource.
        :param database: The Superset database
        :param datasource: The Superset datasource
        :param query: The SQL Lab query
        :param query_context: The query context
        :param table: The Superset table (requires database)
        :param viz: The visualization
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        from superset.connectors.sqla.models import SqlaTable
        from superset.sql_parse import Table

        if database and table or query:
            if query:
                database = query.database

            # database = cast("Database", database)

            if self.can_access_database(database):
                return

            if query:
                tables = {
                    Table(table_.table, table_.schema or query.schema)
                    for table_ in sql_parse.ParsedQuery(query.sql).tables
                }
            elif table:
                tables = {table}

            denied = set()

            for table_ in tables:
                schema_perm = self.get_schema_perm(database, schema=table_.schema)

                if not (schema_perm and self.can_access("schema_access", schema_perm)):
                    datasources = SqlaTable.query_datasources_by_name(
                        self.get_session, database, table_.table_name, schema=table_.schema
                    )

                    # Access to any datasource is suffice.
                    for datasource_ in datasources:
                        if self.can_view_datasource(datasource_):
                            break
                        else:
                            denied.add(table_)

            if denied:
                raise SupersetSecurityException(
                    self.get_table_access_error_object(denied)
                )

        if datasource or query_context or viz:
            if query_context:
                datasource = query_context.datasource
            elif viz:
                datasource = viz.datasource

            assert datasource
            
            if g.user.is_anonymous:
                if not datasource.is_example and not datasource.is_public:        
                    raise SupersetSecurityException(
                        self.get_datasource_access_error_object(datasource)
                    )
            else:
                if not (
                    self.can_access_schema(datasource)
                    or self.can_access("datasource_access", datasource.perm or "")
                    or self.datasource_access_owned(datasource)
                ):
                    raise SupersetSecurityException(
                        self.get_datasource_access_error_object(datasource)
                    )

    def can_view_datasource(self, _):
       raise SupersetException(
           "Please implement can_view_datasource for your Security Manager"
       )


class OverfitSecurityManager(SupersetSecurityManager):
    user_model = MyUser
    userdbmodelview = CustomUserDBModelView
    registeruserdbview = CustomRegisterUserDBView

    WORKFLOW_PERMISSIONS = {
        "workflow_access"
    }

    BETA_ONLY_VIEW_MENUS = {"Upload a CSV", "BillingView"}

    BETA_ONLY_VIEW_MENUS_CUSTOMS = {"SQL Lab"}

    ALPHA_ONLY_VIEW_MENUS = {}

    ALPHA_ONLY_PERMISSIONS = {
        "all_datasource_access",
        "all_database_access",
    }

    BETA_ONLY_PERMISSIONS = {
        "muldelete",
        "can_only_access_owned_databases",
        "can_only_access_owned_datasources",
    }

    GAMMA_READ_ONLY_MODEL_VIEWS = {
        "SqlMetricInlineView",
        "TableColumnInlineView",
        "TableModelView",
        "DruidColumnInlineView",
        "DruidDatasourceModelView",
        "DruidMetricInlineView",
        "SapModelView",
        "LinkedinModelView",
        "OntologyModelView",
        "OverfitView",
        "PredictionView",
        "MappingEntityView"
    } | SupersetSecurityManager.READ_ONLY_MODEL_VIEWS

    def can_only_access_owned_databases(self) -> bool:
        """
        Return True if the user only access own database, False otherwise.

        :returns: Whether the user only access own database
        """

        return self.can_access(
            "can_only_access_owned_databases",
            "can_only_access_owned_databases"
        )

    def can_only_access_owned_datasources(self) -> bool:
        """
        Return True if the user only access own datasource, False otherwise.

        :returns: Whether the user only access own datasource
        """

        return self.can_access(
            "can_only_access_owned_datasources",
            "can_only_access_owned_datasources"
        )

    def _is_workflow_permission(self, perm: Model) -> bool:
        """
        Return True if the FAB permission is workflow related, False otherwise.
        :param perm: The FAB permission
        :returns: Whether the FAB permission is workflow related
        """

        return (perm.permission.name in self.WORKFLOW_PERMISSIONS)

    def create_custom_permissions(self) -> None:
        """
        Create custom FAB permissions.
        """

        super().create_custom_permissions()
        self.add_permission_view_menu("workflow_access", "workflow_access")
        self.add_permission_view_menu(
            "can_only_access_owned_databases",
            "can_only_access_owned_databases"
        )
        self.add_permission_view_menu(
            "can_only_access_owned_datasources",
            "can_only_access_owned_datasources"
        )

    def sync_role_definitions(self) -> None:
        """
        Initialize the Superset application with security roles and such.
        """

        super().sync_role_definitions()
        self.set_role("Beta", self._is_beta_pvm)

    def _is_alpha_only(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Alpha users,
        False otherwise.
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Alpha users
        """

        if (
            pvm.view_menu.name in self.BETA_ONLY_VIEW_MENUS
            and pvm.view_menu.name in self.GAMMA_READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.ALPHA_ONLY_VIEW_MENUS
            or pvm.permission.name in self.ALPHA_ONLY_PERMISSIONS
        )

    def _is_beta_only(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Beta users,
        False otherwise.
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Beta users
        """

        if (
            pvm.view_menu.name in self.GAMMA_READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.ALPHA_ONLY_PERMISSIONS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.BETA_ONLY_VIEW_MENUS
            or pvm.permission.name in self.BETA_ONLY_PERMISSIONS
        )

    def _is_gamma_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Gamma user related, False
        otherwise.
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Gamma related
        """

        return not (
            self._is_user_defined_permission(pvm)
            or self._is_admin_only(pvm)
            or self._is_beta_only(pvm)
            or self._is_alpha_only(pvm)
        ) or self._is_accessible_to_all(pvm) or self._is_workflow_permission(pvm)

    def _is_admin_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Admin user related, False
        otherwise.
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Admin related
        """

        return super()._is_admin_pvm(pvm) or self._is_workflow_permission(pvm)

    def _is_beta_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Beta user related, False
        otherwise.
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Beta related
        """
        from superset import db
        examples_db = get_example_database()
        examples_datasources = ConnectorRegistry.get_all_example_datasources(db.session, examples_db)
        return not (
            self._is_user_defined_permission(pvm)
            or self._is_admin_only(pvm)
            or self._is_alpha_only(pvm)
        ) or (
            pvm.view_menu.name in self.READ_ONLY_MODEL_VIEWS
            and pvm.permission.name in {"can_add", "can_edit", "can_delete"}
        ) or (
            pvm.permission.name in {"can_sql_json"}
        ) or (
            pvm.permission.name in {"database_access"}
            and pvm.view_menu.name in {examples_db.perm}
        ) or (
            pvm.permission.name in {"datasource_access"}
            and pvm.view_menu.name in {ds.perm for ds in examples_datasources}
        ) or (
            pvm.view_menu.name in self.BETA_ONLY_VIEW_MENUS_CUSTOMS
        ) or self._is_accessible_to_all(pvm)

    def database_access_owned(self, database: "Database") -> bool:
        """
        Return True if the user can access the Superset database, False otherwise.

        :param database: The Superset database
        :returns: Whether the user can access the Superset database
        """
        if self.is_beta_user():
            from superset.models.custom import Workspace
            workspace = Workspace.get_workspace_user(g.user)
            if (int(g.user.get_id()) == database.created_by_fk
               or database.id == workspace.db_id 
               or self.can_access("database_access", database.perm)):
                return True
            return False
        else: 
            return self.can_access_database(database)

    def datasource_access_owned(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can access the Superset datasource, False otherwise.

        :param datasource: The Superset datasource
        :returns: Whether the user can access the Superset datasource
        """
        return (
            self.can_access_all_datasources()
            or int(g.user.get_id()) == datasource.created_by_fk
            or int(g.user.get_id()) in [user.id for user in datasource.owners]
        )

    def can_access_schema(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can fully access the schema associated with the Superset
        datasource, False otherwise.
        Note for Druid datasources the database and schema are akin to the Druid cluster
        and datasource name prefix respectively, i.e., [schema.]datasource.
        :param datasource: The Superset datasource
        :returns: Whether the user can fully access the datasource's schema
        """
        if self.can_only_access_owned_datasources():
            """
            For Beta user, they only have perms access to the datasoure/schema allowed
            instead of any datasource/schema in the database which they allowed to access to
            """
            return (
                self.can_access_all_datasources()
                or (self.can_access_database(datasource.database)
                    and self.can_access("schema_access", datasource.schema_perm or "")))

        return (
            self.can_access_all_datasources()
            or self.can_access_database(datasource.database)
            or self.can_access("schema_access", datasource.schema_perm or "")
        )

    def _datasource_access_by_name(
        self, database: "Database", table_name: str, schema: str = None
    ) -> bool:
        """
        Return True if the user can access the SQL table, False otherwise.

        :param database: The SQL database
        :param table_name: The SQL table name
        :param schema: The Superset schema
        :returns: Whether the use can access the SQL table
        """

        from superset import db

        if self.database_access_owned(database) or self.can_access_all_datasources():
            return True

        schema_perm = self.get_schema_perm(database, schema)
        if schema_perm and self.can_access("schema_access", schema_perm):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, table_name, schema=schema
        )
        for datasource in datasources:
            if (
                self.can_access("datasource_access", datasource.perm)
                or self.datasource_access_owned(datasource)
            ):
                return True
        return False

    def get_rls_filters(self, table: "BaseDatasource"):
        """
        Retrieves the appropriate row level security filters for the current user and the passed table.

        :param table: The table to check against
        :returns: A list of filters.
        """
        if hasattr(g, "user") and hasattr(g.user, "id"):
            from superset import db
            from superset.connectors.sqla.models import (
                RLSFilterRoles,
                RowLevelSecurityFilter,
            )

            user_roles = (
                db.session.query(assoc_user_role.c.role_id)
                .filter(assoc_user_role.c.user_id == g.user.id)
                .subquery()
            )
            filter_roles = (
                db.session.query(RLSFilterRoles.c.id)
                .filter(RLSFilterRoles.c.role_id.in_(user_roles))
                .subquery()
            )
            query = (
                db.session.query(
                    RowLevelSecurityFilter.id, RowLevelSecurityFilter.clause
                )
                .filter(RowLevelSecurityFilter.table_id == table.id)
                .filter(RowLevelSecurityFilter.id.in_(filter_roles))
            )
            return query.all()
        return []

    def get_rls_ids(self, table: "BaseDatasource") -> List[int]:
        """
        Retrieves the appropriate row level security filters IDs for the current user and the passed table.

        :param table: The table to check against
        :returns: A list of IDs.
        """
        ids = [f.id for f in self.get_rls_filters(table)]
        ids.sort()  # Combinations rather than permutations
        return ids
        
    def is_beta_user(self) -> bool:
        user = g.user
        user_roles = [role.name.lower() for role in list(user.roles)]
        return "beta" in user_roles    
    
    def user_can_access(self, user_id, permission_name: str, view_name: str) -> bool:
        from superset import db
        user = db.session.query(MyUser).get(user_id)
        if user is None or user.is_anonymous:
            return self.is_item_public(permission_name, view_name)
        return self._has_view_access(user, permission_name, view_name)

    def get_access_databases(self):
        """
        All database user can accesss
        """
        from superset import db
        import superset.models.core as models
        from superset.models.custom import Workspace
        if self.is_beta_user():
            workspace = Workspace.get_or_create_workspace(g.user)
            query = db.session().query(models.Database).filter(
                (models.Database.created_by_fk == g.user.get_id()) | (models.Database.id == workspace.db_id)
            ).all()    
            return query
        else: 
            query = db.session().query(models.Database).all()
            dbs = []
            if self.can_access_all_databases():
                return query

            for database in query:
                if database.created_by_fk == int(g.user.get_id()):
                    dbs.append(database)
                    continue
                if self.can_access_database(database):
                    dbs.append(database)
            return dbs

    def get_schemas_for_csv_upload(self, db_id):
        import superset.models.core as models
        from superset import db
        
        database = db.session.query(models.Database).get(db_id)
        if not database.allow_csv_upload:
          return []
      
        accessible_schemas = self.get_access_schemas(db_id)
        if self.is_beta_user():
            return accessible_schemas
        else:
            schemas_for_upload_csv_from_metadata = database.get_schema_access_for_csv_upload()
            return [schema for schema in accessible_schemas if schema in schemas_for_upload_csv_from_metadata]

    def get_access_schemas(self, db_id, force_refresh="false"):
        """
        schema user can import any tables
        """
        from superset import db
        import superset.models.core as models
        from superset.models.custom import Workspace
        db_id = int(db_id)
        force_refresh = force_refresh.lower() == "true"
        database = db.session.query(models.Database).get(db_id)
        schemas = []
        if self.is_beta_user():
            workspace = Workspace.get_or_create_workspace(g.user)
            if database and database.created_by_fk == int(g.user.get_id()):
                schemas = database.get_all_schema_names(
                    cache=database.schema_cache_enabled,
                    cache_timeout=database.schema_cache_timeout,
                    force=force_refresh,
                )
            elif database and database.id == workspace.db_id:
                if Workspace.check_exist_schema(workspace, str(workspace.name)):
                    schemas.append(str(workspace.name))

            elif self.can_access("database_access", database.perm):
                schemas = database.get_all_schema_names(
                    cache=database.schema_cache_enabled,
                    cache_timeout=database.schema_cache_timeout,
                    force=force_refresh,
                )
                schemas = self.schemas_accessible_by_user(database, schemas)

        else:
            if database:
                schemas = database.get_all_schema_names(
                    cache=database.schema_cache_enabled,
                    cache_timeout=database.schema_cache_timeout,
                    force=force_refresh,
                )
                schemas = self.schemas_accessible_by_user(database, schemas)
                
        return schemas

    def check_role_user(self, role_name) -> bool:
        user = g.user
        user_roles = [role.name.lower() for role in list(user.roles)]
        return role_name.lower() in user_roles 

    def is_example_data_of_chart(self, dataset) -> bool:
        role = self.find_role('Beta')
        pv = self.find_permission_view_menu("datasource_access", dataset.get_perm())
        if pv is not None:
            return self.exist_permission_on_roles(pv.view_menu.name,"datasource_access", [role.id])
        return False

    def add_remove_datasource_to_beta_role(self, datasource, add=True):
        from superset import db
        role = self.find_role('Beta')
        pv = self.find_permission_view_menu("datasource_access", datasource.get_perm())
        if add:
            self.add_permission_role(role, pv)
        else:
            self.del_permission_role(role, pv)
        
    def datasource_can_access_by_beta(self, item):
        role = self.find_role('Beta')
        pv = self.find_permission_view_menu("datasource_access", item.get_perm())
        if pv is not None: 
            return self.exist_permission_on_roles(pv.view_menu.name,"datasource_access", [role.id])
        return False

    def can_create_task(self,raise_if_false=True):
        from superset import app
        security_exception = SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.VIZ_GET_DF_ERROR,
                message="Permission Denied",
                level=ErrorLevel.ERROR,
                )
        )

        if app.config["ALLOW_GUEST_VIEW_PUBLIC_DATA"]:
            if g.user.is_anonymous:
                if raise_if_false:
                    raise security_exception
                return False
        return True
    
    def get_owner_ids(self,user_id, model):
        from superset import db
        User = self.user_model
        query = (
            db.session.query(model.id)
            .with_entities(model.id)
            .join(model.owners)
            .filter(User.id == user_id)
        )
        return query.all()

    def has_permission(self,user_id, permission_name, view_name):
        return self.user_can_access(user_id, permission_name, view_name)
    
    def check_access_permission(self,permission_name, item_id, create_by_fk, view_name, model):
        user_id = g.user.id
        is_allow = self.has_permission(user_id, permission_name, view_name)
        if self.is_beta_user():
            if (user_id == create_by_fk):
                return True
            else:
                owner_ids = self.get_owner_ids(user_id, model)
                is_owner = any(item.id == item_id for item in owner_ids)
                return is_allow and is_owner  
        return is_allow 

    def can_view_datasource(self,table):
        from superset.connectors.sqla import models

        if self.can_access_all_datasources():
            return True

        datasource_perms = self.user_view_menu_names("datasource_access")
        schema_perms = self.user_view_menu_names("schema_access")
        
        if not self.can_only_access_owned_datasources():
            # Admin/Alpha/Gamma can access table if they have permission to access schema
            # Beta user has permission to access schema but maybe does not have permisison to access datasource
            if table.schema_perm in schema_perms:
                return True

        if table.perm in datasource_perms:
            # Permission check already included is_example and is_public
            return True
        elif table.created_by_fk == int(g.user.id):
            # Creator check
            return True
        else:
            # Owner check
            owner_ids = self.get_owner_ids(g.user.id, models.SqlaTable)
            is_owner = any(item.id == table.id for item in owner_ids)
            return is_owner
        
    def can_edit_datasource(self,
    table: Optional["SqlaTable"] = None,
    table_id: Optional[int] = None,
    tablecolumn_id: Optional[int] = None,
    sqlmetric_id: Optional[int] = None):
        from superset import db
        from superset.connectors.sqla import models
        user_id = g.user.id
        is_allow = self.has_permission(user_id, "can_edit", "TableModelView")
        
        if table is None:
            if table_id:
                table = db.session.query(models.SqlaTable).filter(models.SqlaTable.id == table_id).one_or_none()
            elif tablecolumn_id:
                tablecolumn = db.session.query(models.TableColumn).filter(models.TableColumn.id == tablecolumn_id).one_or_none()
                table = tablecolumn.table
            elif sqlmetric_id:
                sqlmetric = db.session.query(models.SqlMetric).filter(models.SqlMetric.id == sqlmetric_id).one_or_none()
                table = sqlmetric.table
        
        if table.is_example:
            if self.check_role_user("admin"):
                return True
            else:
                return False
        else:
            if self.is_beta_user():
                if table.created_by_fk == int(user_id):
                    return True
                else:
                    owner_ids = self.get_owner_ids(user_id, models.SqlaTable)
                    is_owner = any(item.id == table.id for item in owner_ids)
                    return is_allow and is_owner 
            return is_allow

    def can_delete_datasource(self,
    table: Optional["SqlaTable"] = None,
    table_id: Optional[int] = None,
    tablecolumn_id: Optional[int] = None,
    sqlmetric_id: Optional[int] = None):
        from superset import db
        from superset.connectors.sqla import models
        user_id = g.user.id
        is_allow = self.has_permission(user_id, "can_delete", "TableModelView")
        
        if table is None:
            if table_id:
                table = db.session.query(models.SqlaTable).filter(models.SqlaTable.id == table_id).one_or_none()
            elif tablecolumn_id:
                tablecolumn = db.session.query(models.TableColumn).filter(models.TableColumn.id == tablecolumn_id).one_or_none()
                table = tablecolumn.table
            elif sqlmetric_id:
                sqlmetric = db.session.query(models.SqlMetric).filter(models.SqlMetric.id == sqlmetric_id).one_or_none()
                table = sqlmetric.table
        
        if table.is_example:
            if self.check_role_user("admin"):
                return True
            else:
                return False
        else:
            if self.is_beta_user():
                if table.created_by_fk == int(user_id):
                    return True
                else:
                    owner_ids = self.get_owner_ids(user_id, models.SqlaTable)
                    is_owner = any(item.id == table.id for item in owner_ids)
                    return is_allow and is_owner 
            return is_allow
