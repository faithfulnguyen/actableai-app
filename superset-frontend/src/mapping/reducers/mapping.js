/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */
import _ from 'lodash';
import * as actions from '../actions/index';

export default function mappingReducer(state = {}, action) {
  const actionHandlers = {
    [actions.UPDATE_SHOW_TABLE]() {
      return Object.assign({}, state, { showTable: action.tableId, columns: action.columns });
    },
    [actions.UPDATE_ENTITY_COLUMN]() {
      const { columns } = state;
      const i = _.findIndex(columns, { id: action.columnId });
      columns[i].entity = action.entity;
      const changeSelectColumn = Math.random();
      return Object.assign({}, state, { columns, changeSelectColumn });
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
