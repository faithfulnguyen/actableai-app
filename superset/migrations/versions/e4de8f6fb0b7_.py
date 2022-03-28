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

Revision ID: e4de8f6fb0b7
Revises: 30339dcfe097
Create Date: 2020-08-02 15:17:16.236769

"""

# revision identifiers, used by Alembic.
revision = 'e4de8f6fb0b7'
down_revision = '30339dcfe097'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('config',
    sa.Column('created_on', sa.DateTime(), nullable=True),
    sa.Column('changed_on', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('value', sa.Text(), nullable=True),
    sa.Column('created_by_fk', sa.Integer(), nullable=True),
    sa.Column('changed_by_fk', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
    sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('config')
    # ### end Alembic commands ###