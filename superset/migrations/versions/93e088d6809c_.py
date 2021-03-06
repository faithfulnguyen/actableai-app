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
"""Add original_creator to slices and daskboards

Revision ID: 93e088d6809c
Revises: a499092f13c6
Create Date: 2021-11-10 10:19:18.587780

"""

# revision identifiers, used by Alembic.
revision = '93e088d6809c'
down_revision = 'a499092f13c6'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dashboards', sa.Column('is_example', sa.Boolean(), nullable=True))
    op.add_column('slices', sa.Column('is_example', sa.Boolean(), nullable=True))

def downgrade():
    op.drop_column('dashboards', 'is_example')
    op.drop_column('slices', 'is_example')
