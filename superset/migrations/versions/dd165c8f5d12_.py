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
"""Drop urlsafe from dashboard and add column urlsafe to url

Revision ID: dd165c8f5d12
Revises: 84e7d26e3619
Create Date: 2021-10-12 04:18:53.606645

"""

# revision identifiers, used by Alembic.
revision = 'dd165c8f5d12'
down_revision = '84e7d26e3619'

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.drop_column('urlsafe')
    with op.batch_alter_table("url") as batch_op:
        batch_op.add_column(sa.Column("urlsafe", sa.Text(), nullable=True))

def downgrade():
    with op.batch_alter_table("url") as batch_op:
        batch_op.drop_column('urlsafe')
