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

Revision ID: 174dbfa6e1cc
Revises: f4ef0b16c5eb
Create Date: 2020-05-19 07:42:58.118239

"""

# revision identifiers, used by Alembic.
revision = '174dbfa6e1cc'
down_revision = 'f4ef0b16c5eb'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('linkedin_connect_info', sa.Column('sample_rate', sa.Float(), nullable=True))
    op.drop_column('linkedin_connect_info', 'search')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('linkedin_connect_info', sa.Column('search', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.drop_column('linkedin_connect_info', 'sample_rate')
    # ### end Alembic commands ###
