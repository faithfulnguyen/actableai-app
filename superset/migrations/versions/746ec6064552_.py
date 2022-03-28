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

Revision ID: 746ec6064552
Revises: 912ecc9b2504
Create Date: 2019-12-04 03:14:22.958157

"""

# revision identifiers, used by Alembic.
revision = '746ec6064552'
down_revision = '912ecc9b2504'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('linkedin_connect_info',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('email', sa.String(length=50), nullable=False),
    sa.Column('password', sa.String(length=50), nullable=False),
    sa.Column('search', sa.String(length=50), nullable=True),
    sa.Column('group_id', sa.String(length=100), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('linkedin_connect_info')
    # ### end Alembic commands ###