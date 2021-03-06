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
"""init_config

Revision ID: 0475c6711c4e
Revises: e4de8f6fb0b7
Create Date: 2020-08-02 15:19:15.165354

"""

# revision identifiers, used by Alembic.
revision = '0475c6711c4e'
down_revision = 'e4de8f6fb0b7'

from alembic import op
import sqlalchemy as sa


def upgrade():
    conn = op.get_bind()
    conn.execute("INSERT INTO config (name, value) VALUES ('FILE_UPLOAD_LIMIT_SIZE','10') ON CONFLICT (name) DO "
                 "NOTHING")
    pass


def downgrade():
    pass
