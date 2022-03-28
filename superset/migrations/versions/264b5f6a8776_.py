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
"""Rename examples to actableai

Revision ID: 264b5f6a8776
Revises: 93e088d6809c
Create Date: 2021-12-10 07:22:49.777040

"""

# revision identifiers, used by Alembic.
revision = '264b5f6a8776'
down_revision = '93e088d6809c'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # tables
    op.execute('UPDATE "public"."tables" SET perm = REPLACE(perm,\'examples\',\'actableai\'), schema_perm = REPLACE(schema_perm,\'examples\',\'actableai\') WHERE true;')
    # slices
    op.execute('UPDATE "public"."slices" SET perm = REPLACE(perm,\'examples\',\'actableai\'), schema_perm = REPLACE(schema_perm,\'examples\',\'actableai\') WHERE true;')
    # datasources
    op.execute('UPDATE "public"."datasources" SET perm = REPLACE(perm,\'examples\',\'actableai\'), schema_perm = REPLACE(schema_perm,\'examples\',\'actableai\') WHERE true;')
    # dbs
    op.execute('UPDATE "public"."dbs" SET perm = REPLACE(perm,\'examples\',\'actableai\'), database_name = REPLACE(database_name,\'examples\',\'actableai\') WHERE true;')

    # ab_view_menu
    op.execute('UPDATE "public"."ab_view_menu" SET name = REPLACE(name,\'examples\',\'actableai\') WHERE true;')


def downgrade():
    # tables
    op.execute('UPDATE "public"."tables" SET perm = REPLACE(perm,\'actableai\',\'examples\'), schema_perm = REPLACE(schema_perm,\'actableai\',\'examples\') WHERE true;')
    # slices
    op.execute('UPDATE "public"."slices" SET perm = REPLACE(perm,\'actableai\',\'examples\'), schema_perm = REPLACE(schema_perm,\'actableai\',\'examples\') WHERE true;')
    # datasources
    op.execute('UPDATE "public"."datasources" SET perm = REPLACE(perm,\'actableai\',\'examples\'), schema_perm = REPLACE(schema_perm,\'actableai\',\'examples\') WHERE true;')
    # dbs
    op.execute('UPDATE "public"."dbs" SET perm = REPLACE(perm,\'actableai\',\'examples\'), database_name = REPLACE(database_name,\'actableai\',\'examples\') WHERE true;')
    # ab_view_menu
    op.execute('UPDATE "public"."ab_view_menu" SET name = REPLACE(name,\'actableai\',\'examples\') WHERE true;')

