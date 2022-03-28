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

Revision ID: 9097c257f3e0
Revises: 5fe8a2b3d62d
Create Date: 2020-07-07 09:18:39.629355

"""

# revision identifiers, used by Alembic.
revision = '9097c257f3e0'
down_revision = '5fe8a2b3d62d'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('dbs', sa.Column('db_driver', sa.String(length=50), nullable=True))
    op.add_column('dbs', sa.Column('db_host', sa.String(length=100), nullable=True))
    op.add_column('dbs', sa.Column('db_name', sa.String(length=100), nullable=True))
    op.add_column('dbs', sa.Column('db_port', sa.Integer(), nullable=True))
    op.add_column('dbs', sa.Column('db_user', sa.String(length=100), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('dbs', 'db_driver')
    op.drop_column('dbs', 'db_host')
    op.drop_column('dbs', 'db_name')
    op.drop_column('dbs', 'db_port')
    op.drop_column('dbs', 'db_user')
    # ### end Alembic commands ###
