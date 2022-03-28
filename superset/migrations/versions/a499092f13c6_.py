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
"""Change unique tables

Revision ID: a499092f13c6
Revises: dd165c8f5d12
Create Date: 2021-10-09 03:54:58.372584

"""

# revision identifiers, used by Alembic.
revision = 'a499092f13c6'
down_revision = 'dd165c8f5d12'

from alembic import op
import sqlalchemy as sa

def upgrade():
    try:
        op.drop_constraint(u"_customer_location_uc", "tables", type_="unique")
        op.create_unique_constraint("_customer_location_uc", "tables", ["database_id", "schema", "table_name", "created_by_fk"])
    except Exception:
        pass


def downgrade():
    try:
        op.drop_constraint(u"_customer_location_uc", "tables", type_="unique")
        op.create_unique_constraint(
            "_customer_location_uc", "tables", ["database_id", "schema", "table_name"]
        )
    except Exception:
        pass
