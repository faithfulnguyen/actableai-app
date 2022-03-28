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
import * as actions from '../actions/predictActions';

export default function predictReducer(state = {}, action) {
  const actionHandlers = {
    [actions.FETCH_TABLE_SUCCEEDED]() {
      return Object.assign({}, state, { tables: action.tables });
    },
    [actions.UPDATE_TABLE_EMPTY]() {
      return Object.assign({}, state, { tables: [] });
    },
    [actions.UPDATE_TABLE_SUCCESS]() {
      const trainValue = Object.assign({}, state.trainValue, { nameTable: action.tables });
      return Object.assign({}, state, { trainValue });
    },
    [actions.FETCH_PREDICTING_VARIABLE_SUCCEEDED]() {
      return Object.assign({}, state, { predictingVariable: action.columns });
    },
    [actions.UPDATE_PREDICTING_VARIABLE_SUCCESS]() {
      const trainValue = Object.assign({}, state.trainValue, { predictValue: action.predictValue });
      return Object.assign({}, state, { trainValue });
    },
    [actions.UPDATE_PREDICTING_VARIABLE_EMPTY]() {
      return Object.assign({}, state, { predictingVariable: [] });
    },
    [actions.UPDATE_DATASOURCE_SUCCESS]() {
      const trainValue = Object.assign({}, state.trainValue, { nameDatabase: action.datasource });
      return Object.assign({}, state, { trainValue });
    },
    [actions.UPDATE_TEST_PREDICTIONS]() {
      return Object.assign({}, state, { testPredictions: [action.testPredictions] });
    },
    [actions.UPDATE_TEST_FIELD_SUCCESS]() {
      const { testValue } = state;
      testValue[action.fieldName] = null;
      return Object.assign({}, state, { testValue });
    },
    [actions.UPDATE_VALUE_FIELD_TEST]() {
      const testValue = Object.assign({}, state.testValue, action.fieldValue);
      return Object.assign({}, state, { testValue });
    },
    [actions.UPDATE_TRAIN_SUCCESS]() {
      const train = Object.assign({}, state.train, action.data);
      return Object.assign({}, state, { train });
    },
    [actions.UPDATE_LOADING_SUCCESS]() {
      return Object.assign({}, state, { loading: action.loading });
    },
    [actions.UPDATE_RESULT_SUCCESS]() {
      const result = Object.assign({}, state.result, action.data);
      return Object.assign({}, state, { result });
    },
    [actions.UPDATE_INPUT_DATA_SUCCESS]() {
      const inputData = Object.assign({}, state.inputData, action.input);
      return Object.assign({}, state, { inputData });
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}