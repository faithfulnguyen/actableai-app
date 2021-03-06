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

Revision ID: 70bb187a046e
Revises: 0945a5705b8f
Create Date: 2021-06-28 15:31:49.324197

"""

# revision identifiers, used by Alembic.
revision = '70bb187a046e'
down_revision = '0945a5705b8f'

from alembic import op


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute("TRUNCATE public.billing_promo_history")
    op.execute("TRUNCATE public.billing_subscriptions CASCADE")
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
