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
 * Unless required by applicable law or agreed to in writing,series
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t } from '@superset-ui/translation';
import controls from '../controls';
import * as v from '../validators';
import { detectIntWithNanColumns, getMutauallyExculusiveOptions, getOptionsFromValue } from './Utils';

let columns = [];
let prediction = null;

const mutuallyExculsiveMultiDropdowns = ['all_columns', 'biased_groups', 'extra_columns'];
const mutuallyExculsiveDropdowns = ['prediction'];

const exclusiveOptions = (state, fieldName, whitelistTypes, blacklistTypes) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes, blacklistTypes);
const exclusiveOptionsForDebiasing = (state, fieldName) => getMutauallyExculusiveOptions(state, fieldName, ['biased_groups'], ['prediction']);

export default {
  label: t('Classification Analytics'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['prediction'],
        ['all_columns'],
        ['biased_groups'],
        ['debiased_features'],
        ['extra_columns'],
        ['adhoc_filters'],
        ['optimization_presets'],
        ['explain_predictions'],
        ['cross_validation'],
        ['ratio'],
        ['kfolds']
      ],
    },
  ],
  controlOverrides: {
    prediction: {
      description: t('The column whose missing values will be predicted. Filled values are used for training and validation. Without missing values, only performance on validation will be displayed.'),
      mapStateToProps: (state) => {
        const newState = {};
        if (state.datasource) {
          let columnNamesOfIntWithNaN = detectIntWithNanColumns(state.datasource).map(x => x.column_name);
          newState.options = exclusiveOptions(state, 'prediction').filter(
            c => c.type !== null && (c.type === "BIGINT" || c.type === "BOOLEAN" || c.type.includes("VARCHAR") || columnNamesOfIntWithNaN.includes(c.column_name))
          );
        }
        return newState;
      },
    },
    all_columns: {
      label: t('Predictors'),
      description: t('Columns that are used to predict the predicted target.'),
      mapStateToProps: (state) => ({options: exclusiveOptions(state, 'all_columns')}),
      validators: [v.nonEmpty],
      dependents: ['debiased_features']
    },
    biased_groups: {
      mapStateToProps: (state, control) => {
        if(!state?.controls) return;
        const optimizationPresets = state?.controls?.optimization_presets?.value;

        const disabledReasons = []
        if (optimizationPresets) disabledReasons.push(t('Incompatible with Optimize for performance'))

        const disabled = disabledReasons.length > 0;
        const value = disabled ? false : control.value;
        return { disabled, value, disabledReasons, options: exclusiveOptions(state, 'biased_groups', undefined, ['TEXT'])}
      },
      dependents: ['debiased_features', 'optimization_presets'],
    },
    debiased_features: {
      mapStateToProps: (state) => ({ options: getOptionsFromValue(state, 'all_columns').filter(option => !['DATE', 'TIMESTAMP WITHOUT TIME ZONE', 'TEXT'].includes(option.type)) }),
      shouldDisplayFunc: controls => (controls?.biased_groups?.value?.length || 0) > 0,
      validators: [(value, state) => {
        if ((state?.controls?.biased_groups?.value?.length || 0) > 0) {
          return v.nonEmpty(value);
        }
        return false;
      }]
    },
    extra_columns: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'extra_columns') }),
    },
    optimization_presets: {
      mapStateToProps: (state, control) => {
        if(!state?.controls) return;
        const debiasing = state?.controls?.biased_groups?.value?.length;

        const disabledReasons = []
        if (debiasing) disabledReasons.push(t('Incompatible with debiasing'))

        const disabled = disabledReasons.length > 0;
        const value = disabled ? false : control.value;
        return { disabled, value, disabledReasons }
      },
      dependents: ['biased_groups']
    },
    cross_validation: {
      default: false,
      dependents: ['ratio', 'kfolds']
    },
    adhoc_filters: {
      description: t('Only filtered data are trained and predicted.')
    },
    ratio: {
      shouldDisplayFunc: controls => !controls?.cross_validation?.value || false,
    },
    kfolds: {
      shouldDisplayFunc: controls => controls?.cross_validation?.value || false,
    }
  }
};
