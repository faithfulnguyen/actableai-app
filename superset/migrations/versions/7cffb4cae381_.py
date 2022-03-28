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
"""empty message

Revision ID: 7cffb4cae381
Revises: 264b5f6a8776
Create Date: 2022-01-28 17:09:15.030163

"""

# revision identifiers, used by Alembic.
revision = '7cffb4cae381'
down_revision = '264b5f6a8776'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    op.add_column('tables', sa.Column(
            'is_example', sa.Boolean(), default=False))
    op.add_column('tables', sa.Column('is_public', sa.Boolean(), default=False))


def downgrade():
    op.drop_column('tables', 'is_public')
    op.drop_column('tables', 'is_example')
