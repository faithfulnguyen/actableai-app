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
import logging
from superset.db_engine_specs.base import BaseEngineSpec
from typing import Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.models.core import Database
from superset.connectors.sqla.models import SqlaTable
from superset.dao.exceptions import DAODeleteFailedError
from superset.datasets.commands.exceptions import (
    DatasetDeleteFailedError,
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.datasets.dao import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class DeleteDatasetCommand(BaseCommand):
    def __init__(self, user: User, model_id: int):
        self._actor = user
        self._model_id = model_id
        self._model: Optional[SqlaTable] = None

    def run(self):
        self.validate()
        try:
            dataset = DatasetDAO.delete(self._model, commit=False)
            security_manager.del_permission_view_menu(
                "datasource_access", dataset.get_perm()
            )
            db.session.commit()

            self.post_delete()

        except (SQLAlchemyError, DAODeleteFailedError) as e:
            logger.exception(e)
            db.session.rollback()
            raise DatasetDeleteFailedError()
        return dataset

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        # Check ownership
        try:
            check_ownership(self._model)
        except SupersetSecurityException:
            raise DatasetForbiddenError()

    def post_delete(self):
        if self._model.is_uploaded:
            drop_table_query = 'DROP TABLE IF EXISTS ' + f'"{self._model.schema}"."{self._model.table_name}"'
            database = self._model.database
            engine = BaseEngineSpec.get_engine(database)
            with engine.connect() as con:
                con.execute(drop_table_query)
