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

from distutils.command.config import config
from sqlalchemy import or_, and_
from flask import g, request
from superset import security_manager, db, app
from superset.models.slice import Slice
from superset.views.base import BaseFilter
from superset.connectors.sqla.models import SqlaTable


class SliceFilter(BaseFilter):
    def apply(self, query, func):  # noqa
        if security_manager.can_access_all_datasources():
            return query

        User = security_manager.user_model

        slice_owner_ids_qry = (db.session.query(Slice.id).join(Slice.owners).filter(User.id == User.get_user_id()))
        datasource_owner_ids_qry = (
            db.session.query(Slice.datasource_id).join(SqlaTable, SqlaTable.id == Slice.datasource_id)
                .join(SqlaTable.owners).filter(User.id == User.get_user_id()))

        perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")
        if app.config["ALLOW_GUEST_VIEW_PUBLIC_DATA"]:
            if g.user.is_anonymous:
                return query.filter(
                        or_(self.model.is_example == True))
        
        if security_manager.is_beta_user():
        # we don't have permission for analytics 
        # and due to even Beta user can access datasource 
        # but they are not allow to access analytic based on that datasource
        # so no need check analytics permisison for Beta user.
            return query.filter(
                or_(self.model.created_by_fk == g.user.get_id(),
                    self.model.is_example == True,
                    Slice.id.in_(slice_owner_ids_qry)))
        return query.filter(
            or_(self.model.perm.in_(perms), 
                self.model.schema_perm.in_(schema_perms),
                and_(Slice.id.in_(slice_owner_ids_qry), 
                     Slice.datasource_id.in_(datasource_owner_ids_qry)
                    )
                )
        )


class SliceOwnerFilter(BaseFilter):
    def apply(self, query, value):
        User = security_manager.user_model
        slice_id = request.view_args['pk']
        obj_slice = db.session.query(Slice).filter_by(id=slice_id).first()
        owner_ids = [g.user.get_id()]
        if obj_slice:
            owner_ids = owner_ids + [owner.id for owner in obj_slice.owners]
            
        return query.filter(User.id.in_([g.user.get_id()]))

