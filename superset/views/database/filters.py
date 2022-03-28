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
from sqlalchemy import or_

from superset import security_manager
from superset.views.base import BaseFilter
from flask import g
from superset.utils.core import get_example_database


class DatabaseFilter(BaseFilter):
    # TODO(bogdan): consider caching.
    def schema_access_databases(self):  # noqa pylint: disable=no-self-use
        found_databases = set()
        for vm in security_manager.user_view_menu_names("schema_access"):
            database_name, _ = security_manager.unpack_schema_perm(vm)
            found_databases.add(database_name)
        return found_databases

    def apply(
        self, query, func
    ):  # noqa pylint: disable=unused-argument,arguments-differ
        from superset.models.core import Database
        can_access_databases =  security_manager.get_access_databases();
        return query.filter(Database.id.in_([db.id for db in can_access_databases]))
