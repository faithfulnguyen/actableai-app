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
"""Add column urlsafe to daskboards

Revision ID: 84e7d26e3619
Revises: ac01e76e2a7b
Create Date: 2021-09-08 10:37:35.868823

"""

# revision identifiers, used by Alembic.
revision = '84e7d26e3619'
down_revision = 'ac01e76e2a7b'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import secrets

def upgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.add_column(sa.Column("urlsafe", sa.Text(), nullable=True))
    op.execute('UPDATE dashboards SET urlsafe = uuid_generate_v4() WHERE 1 = 1')

def downgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.drop_column('urlsafe')
