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

Revision ID: ac01e76e2a7b
Revises: 70bb187a046e
Create Date: 2021-08-05 09:20:16.799111

"""

# revision identifiers, used by Alembic.
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa
from alembic import op
revision = 'ac01e76e2a7b'
down_revision = '70bb187a046e'


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'actable_workspace',
        sa.Column('id', sa.BigInteger(),
                  autoincrement=True, nullable=False),
        sa.Column('name', postgresql.UUID(
            as_uuid=True), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('db_id', sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(['db_id'], ['dbs.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('actable_workspace')
    # ### end Alembic commands ###
