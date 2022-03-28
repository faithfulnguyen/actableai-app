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

Revision ID: c6dbf5ec4e77
Revises: 5fef12f95526
Create Date: 2021-04-16 01:51:50.040518

"""

# revision identifiers, used by Alembic.
revision = 'c6dbf5ec4e77'
down_revision = '5fef12f95526'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('billing_plans',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('type', sa.Enum('USAGE_BASED', name='typeplan'), nullable=False),
    sa.Column('number_of_hours', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('billing_balance_history',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('task_id', sa.String(length=100), nullable=True),
    sa.Column('viz_type', sa.String(length=100), nullable=True),
    sa.Column('url', sa.Text(), nullable=True),
    sa.Column('create_time', sa.DateTime(), nullable=False),
    sa.Column('number_of_seconds', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('billing_subscriptions',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('plan_id', sa.BigInteger(), nullable=False),
    sa.Column('start_time', sa.DateTime(), nullable=True),
    sa.Column('end_time', sa.DateTime(), nullable=True),
    sa.Column('renew', sa.Enum('ACTIVATED', 'UNACTIVATED', name='renewsubscription'), nullable=False),
    sa.Column('billing_available_time', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['plan_id'], ['billing_plans.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('billing_invoices',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('create_time', sa.DateTime(), nullable=False),
    sa.Column('subscription_id', sa.BigInteger(), nullable=True),
    sa.Column('stripe_transaction_id', sa.String(length=100), nullable=False),
    sa.Column('status', sa.Enum('SUCCESSFULLY', 'PENDING', 'FAILURE', name='statusinvoice'), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['subscription_id'], ['billing_subscriptions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('billing_invoices')
    op.drop_table('billing_subscriptions')
    op.drop_table('billing_balance_history')
    op.drop_table('billing_plans')
    # ### end Alembic commands ###