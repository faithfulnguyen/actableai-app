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
import { t } from '@superset-ui/translation';
import { dateTypes, numberTypes } from '../consts';
import { nonEmpty } from '../validators';
import { categoricalTypes, getColumnDataType, getMutauallyExculusiveOptions } from './Utils';

const mutuallyExculsiveMultiDropdowns = ['common_causes'];
const mutuallyExculsiveDropdowns = ['outcome', 'treatment', 'treatment_control', 'effect_modifier'];
const blackListTypes = [...dateTypes, 'TEXT'];

const exclusiveOptions = (state, fieldName, whitelistTypes, blacklistTypes) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes, blacklistTypes);

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['outcome'],
        ['positive_outcome_value'],
        ['treatment'],
        ['treatment_control'],
        ['effect_modifier'],
        ['common_causes'],
        ['adhoc_filters'],
        ['log_treatment'],
        ['log_outcome'],
      ],
    },
  ],
  controlOverrides: {
    outcome: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'outcome', [...numberTypes, ...categoricalTypes]) }),
    },
    positive_outcome_value: {
      validators: [(value, state) => {
        if(state && categoricalTypes.includes(getColumnDataType(state.datasource, state.controls?.outcome?.value))) {
          return nonEmpty(value)
        }
        return false;
      }],
      clearable: false,
      shouldDisplayFunc: controls => {
        if(!controls?.datasource?.datasource) return false;
        return categoricalTypes.includes(getColumnDataType(controls.datasource.datasource, controls.outcome?.value))
      },
    },
    treatment: {
      validators: [nonEmpty],
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'treatment', undefined, blackListTypes) }),
      dependents: ['treatment_control', 'log_treatment' , 'log_outcome'],
    },
    treatment_control: {
      validators: [(value, state) => {
        if(state && categoricalTypes.includes(getColumnDataType(state.datasource, state.controls?.treatment?.value))) {
          return nonEmpty(value)
        }
        return false;
      }],
      clearable: false,
      shouldDisplayFunc: controls => {
        if(!controls?.datasource?.datasource) return false;
        return categoricalTypes.includes(getColumnDataType(controls.datasource.datasource, controls.treatment?.value))
      },
    },
    effect_modifier: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'effect_modifier', undefined, blackListTypes) }),
    },
    common_causes: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state,'common_causes', undefined, blackListTypes) }),
    },
    log_treatment: {
      shouldDisplayFunc: controls => {
        if(!controls?.datasource?.datasource) return false;
        return !categoricalTypes.includes(getColumnDataType(controls.datasource.datasource, controls.treatment?.value))
      }
    },
    log_outcome: {
      shouldDisplayFunc: controls => {
        if(!controls?.datasource?.datasource) return false;
        return !categoricalTypes.includes(getColumnDataType(controls.datasource.datasource, controls.treatment?.value))
      }
    },
    num_trials: {
      description: t('Number of trials for hyper-parameter optimization. Increasing the number of trials usually results in more accurate estimation of causal effects but takes longer time to run.'),
    }
  },
};
