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
"""abc

Revision ID: 30339dcfe097
Revises: 9097c257f3e0
Create Date: 2020-07-09 10:35:36.905629

"""

# revision identifiers, used by Alembic.
revision = '30339dcfe097'
down_revision = '9097c257f3e0'

from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.url import make_url


def upgrade():
    table_name = 'dbs'
    conn = op.get_bind()
    res = conn.execute("SELECT id, sqlalchemy_uri FROM dbs")
    results = res.fetchall()
    for r in results:
        url = make_url(r[1])
        # handle for sql connection string without port
        if url.port is None:
            conn.execute("UPDATE {} SET db_driver = '{}', db_host = '{}', db_name = '{}', db_user = '{}' "
                         "WHERE id = {}".format(table_name, url.drivername, url.host, url.database, url.username, r[0]))
        else:
            conn.execute(
                "UPDATE {} SET db_driver = '{}', db_host = '{}', db_name = '{}', db_port = '{}', db_user = '{}' "
                "WHERE id = {}".format(table_name, url.drivername, url.host, url.database, url.port,
                                       url.username, r[0]))


def downgrade():
    pass
