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
import { SupersetClient } from '@superset-ui/connection';

export const FETCH_TABLE_SUCCEEDED = 'FETCH_TABLE_SUCCEEDED';
export function fetchTableSucceeded(tables) {
  return { type: FETCH_TABLE_SUCCEEDED, tables };
}

export const FETCH_TABLE_FAILED = 'FETCH_TABLE_FAILED';
export function fetchTableFailed(datasourceId) {
  return { type: FETCH_TABLE_FAILED, datasourceId };
}

export const UPDATE_TABLE_EMPTY = 'UPDATE_TABLE_EMPTY';
export function updateTableEmpty() {
  return { type: UPDATE_TABLE_EMPTY };
}

export const FETCH_PREDICTING_VARIABLE_SUCCEEDED = 'FETCH_PREDICTING_VARIABLE_SUCCEEDED';
export function fetchPredictingVariableSucceeded(columns) {
  return { type: FETCH_PREDICTING_VARIABLE_SUCCEEDED, columns };
}

export const FETCH_PREDICTING_VARIABLE_FAILED = 'FETCH_TPREDICTING_VARIABLE_FAILED';
export function fetchPredictingVariableFailed(TableId) {
  return { type: FETCH_PREDICTING_VARIABLE_FAILED, TableId };
}

export const UPDATE_TABLE_SUCCESS = 'UPDATE_TABLE_SUCCESS';
export function updateTableSuccess(tables) {
  return { type: UPDATE_TABLE_SUCCESS, tables };
}

export const UPDATE_PREDICTING_VARIABLE_EMPTY = 'UPDATE_PREDICTING_VARIABLE_EMPTY';
export function updatePredictingVariableEmpty() {
  return { type: UPDATE_PREDICTING_VARIABLE_EMPTY };
}

export const UPDATE_PREDICTING_VARIABLE_SUCCESS = 'UPDATE_PREDICTING_VARIABLE_SUCCESS';
export function updatePredictingVariableSuccess(predictValue) {
  return { type: UPDATE_PREDICTING_VARIABLE_SUCCESS, predictValue };
}

export const UPDATE_DATASOURCE_SUCCESS = 'UPDATE_DATASOURCE_SUCCESS';
export function updateDatasourceSuccess(datasource) {
  return { type: UPDATE_DATASOURCE_SUCCESS, datasource };
}

export const UPDATE_TEST_PREDICTIONS = 'UPDATE_TEST_PREDICTIONS';
export function updateTestPredictionSuccess(testPredictions) {
  return { type: UPDATE_TEST_PREDICTIONS, testPredictions };
}

export const UPDATE_TEST_FIELD_SUCCESS = 'UPDATE_TEST_FIELD_SUCCESS';
export function updateTestFieldSuccess(fieldName) {
  return { type: UPDATE_TEST_FIELD_SUCCESS, fieldName };
}

export const UPDATE_VALUE_FIELD_TEST = 'UPDATE_VALUE_FIELD_TEST';
export function updateValueFieldTestSuccess(fieldValue) {
  return { type: UPDATE_VALUE_FIELD_TEST, fieldValue };
}

export const UPDATE_TRAIN_SUCCESS = 'UPDATE_TRAIN_SUCCESS';
export function updateTrainSuccess(data) {
  return { type: UPDATE_TRAIN_SUCCESS, data };
}

export const UPDATE_LOADING_SUCCESS = 'UPDATE_LOADING_SUCCESS';
export function updateLoadingSuccess(loading) {
  return { type: UPDATE_LOADING_SUCCESS, loading };
}

export const UPDATE_RESULT_SUCCESS = 'UPDATE_RESULT_SUCCESS';
export function updateResultSuccess(data) {
  return { type: UPDATE_RESULT_SUCCESS, data };
}

export const UPDATE_INPUT_DATA_SUCCESS = 'UPDATE_INPUT_DATA_SUCCESS';
export function updateInputDataSuccess(input) {
  return { type: UPDATE_INPUT_DATA_SUCCESS, input };
}

export function updateValueFieldTest(fieldValue) {
  return (dispatch) => {
    return dispatch(updateValueFieldTestSuccess(fieldValue));
  }
}

export function removeFieldNextSelect(fieldName) {
  return (dispatch) => {
    return dispatch(removeFieldNextSelectSuccess(fieldName));
  }
}

export function updateNextSelectTest(nextSelects) {
  return (dispatch) => {
    return dispatch(updateNextSelectTestSuccess(nextSelects));
  }
}

export function updateTestField(fieldName) {
  return (dispatch) => {
    return dispatch(updateTestFieldSuccess(fieldName));
  }
}

export function upateTestPredictions(testPredictions) {
  return (dispatch) => {
    return dispatch(updateTestPredictionSuccess(testPredictions));
  }
}

export function testPrediction(value) {
  const inputData = JSON.stringify(value.inputData);
  const data = Object.assign({}, value, { inputData });
  return (dispatch) => {
    return SupersetClient.post({
      endpoint: `/prediction/api/predict`,
      postPayload: data,
      stringify: false,
    })
      .then(({ json }) => {
        return json;
      })
      .catch(() => false);
  };
}

export function trainModel(trainValue) {
  return (dispatch) => {
    return SupersetClient.post({
      endpoint: `/prediction/api/train`,
      postPayload: trainValue,
      stringify: false,
    })
      .then(({ json }) => {
        return json;
      })
      .catch(() => false);
  };
}

export function updateDatasource(datasource) {
  return (dispatch) => {
    return dispatch(updateDatasourceSuccess(datasource));
  }
}

export function updateTable(table) {
  return (dispatch) => {
    return dispatch(updateTableSuccess(table));
  }
}

export function updatePredictingVariable(predictValue) {
  return (dispatch) => {
    return dispatch(updatePredictingVariableSuccess(predictValue));
  }
}

export function updateTrain(data) {
  return (dispatch) => {
    return dispatch(updateTrainSuccess(data));
  }
}

export function updateLoading(loading) {
  return (dispatch) => {
    return dispatch(updateLoadingSuccess(loading));
  }
}

export function updateResult(data) {
  return (dispatch) => {
    return dispatch(updateResultSuccess(data));
  }
}

export function updateInputData(input) {
  return (dispatch) => {
    return dispatch(updateInputDataSuccess(input));
  }
}

export function fetchTable(datasourceId) {
  return (dispatch) => {
    return SupersetClient.get({
      endpoint: `/prediction/api/${datasourceId}/datasources`,
    })
      .then(({ json }) => {
        const { datasources } = json;
        return dispatch(fetchTableSucceeded(datasources));
      })
      .catch(() => dispatch(fetchTableFailed(datasourceId)));
  };
}

export function fetchPredictingVariable(TableId) {
  return (dispatch) => {
    return SupersetClient.get({
      endpoint: `/prediction/api/${TableId}/columns`,
    })
      .then(({ json }) => {
        const { columns } = json;
        return dispatch(fetchPredictingVariableSucceeded(columns));
      })
      .catch(() => dispatch(fetchPredictingVariableFailed(TableId)));
  };
}