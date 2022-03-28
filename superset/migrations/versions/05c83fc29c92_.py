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

Revision ID: 05c83fc29c92
Revises: 174dbfa6e1cc
Create Date: 2020-05-24 15:05:32.275169

"""

# revision identifiers, used by Alembic.
revision = '05c83fc29c92'
down_revision = '174dbfa6e1cc'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('linkedin_connect_info', sa.Column('current_page', sa.Integer(), nullable=True))
    op.add_column('linkedin_connect_info', sa.Column('search_url', sa.Text(), nullable=True))
    op.add_column('linkedin_connect_info', sa.Column('temp_cookies', sa.Text(), nullable=True))
    op.add_column('linkedin_connect_info', sa.Column('total_result', sa.Integer(), nullable=True))
    op.drop_column('linkedin_connect_info', 'education')
    op.drop_column('linkedin_connect_info', 'location')
    op.drop_column('linkedin_connect_info', 'company')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('linkedin_connect_info', sa.Column('company', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.add_column('linkedin_connect_info', sa.Column('location', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.add_column('linkedin_connect_info', sa.Column('education', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.drop_column('linkedin_connect_info', 'total_result')
    op.drop_column('linkedin_connect_info', 'temp_cookies')
    op.drop_column('linkedin_connect_info', 'search_url')
    op.drop_column('linkedin_connect_info', 'current_page')
    # ### end Alembic commands ###