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
import * as v from '../validators';
import { detectIntWithNanColumns, getMutauallyExculusiveOptions, getOptionsFromValue, numericTypes } from './Utils';

let columns = [];
let prediction = null;

const mutuallyExculsiveMultiDropdowns = ['all_columns', 'biased_groups', 'extra_columns'];
const mutuallyExculsiveDropdowns = ['prediction'];

const exclusiveOptions = (state, fieldName, whitelistTypes, blacklistTypes) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes, blacklistTypes);

const exclusiveOptionsForDebiasing = (state, fieldName) => getMutauallyExculusiveOptions(
  state, fieldName, ['biased_groups'], ['prediction']);

const exclusiveInterventionOptions = (state, fieldName) => getMutauallyExculusiveOptions(
  state, fieldName, ["all_columns"], ['prediction']);

export default {
  label: t('Regression Analytics'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      description: '',
      controlSetRows: [
        ['prediction'],
        ['all_columns'],
        ['biased_groups'],
        ['debiased_features'],
        ['extra_columns'],
        ['adhoc_filters'],
        ['explain_predictions'],
        ['optimization_presets'],
        ['quantile_mode'],
        ['regression_quantile_low'],
        ['regression_quantile_high'],
        ['cross_validation'],
        ['ratio'],
        ['kfolds'],
      ],
    },
    {
      customTab: true,
      label: t('Counterfactual'),
      expanded: true,
      description: "Counterfactual predictions with new intervention values",
      controlSetRows: [
        ["treatment"],
        ["new_treatment"],
        ["common_causes"],
        ['kfolds'],
      ],
    }
  ],
  controlOverrides: {
    prediction: {
      description: t('The column to be predicted.'),
      mapStateToProps: (state) => {
        const newState = {};
        if (state.datasource) {
          // let columnNamesOfIntWithNaN = detectIntWithNanColumns(state.datasource).map(x => x.column_name);
          newState.options = exclusiveOptions(state, 'prediction', numericTypes);
        }
        return newState;
      }
    },
    all_columns: {
      label: t('Predictors'),
      description: t('Columns to be used to calculate our predictions.'),
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'all_columns') }),
      validators: [v.nonEmpty],
      dependents: ['debiased_features', 'common_causes', 'treatment']
    },
    biased_groups: {
      mapStateToProps: (state, control) => {
        if(!state?.controls) return;
        const quantile_mode = state?.controls?.quantile_mode?.value;
        const optimizationPresets = state?.controls?.optimization_presets?.value;

        const disabledReasons = []
        if (quantile_mode) disabledReasons.push(t('Incompatible with Prediction interval'))
        if (optimizationPresets) disabledReasons.push(t('Incompatible with Optimize for performance'))

        const disabled = disabledReasons.length > 0;
        const value = disabled ? false : control.value;
        return { disabled, value, disabledReasons, options: exclusiveOptions(state, 'biased_groups', undefined, ['TEXT'])}
      },
      dependents: ['quantile_mode', 'debiased_features', 'optimization_presets']
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
        const quantileMode = state?.controls?.quantile_mode?.value;
        const debiasing = state?.controls?.biased_groups?.value?.length;

        const disabledReasons = []
        if (quantileMode) disabledReasons.push(t('Incompatible with Prediction interval'))
        if (debiasing) disabledReasons.push(t('Incompatible with debiasing'))

        const disabled = disabledReasons.length > 0;
        const value = disabled ? false : control.value;
        return { disabled, value, disabledReasons }
      },
      dependents: ['quantile_mode', 'regression_quantile_low', 'regression_quantile_high', 'biased_groups']
    },
    quantile_mode: {
      default: false,
      mapStateToProps: (state, control) => {
        if(!state?.controls) return;
        const optimizationPresets = state?.controls?.optimization_presets?.value;
        const debiasing = state?.controls?.biased_groups?.value?.length;

        const disabledReasons = []
        if (optimizationPresets) disabledReasons.push(t('Incompatible with Optimize for performance'))
        if (debiasing) disabledReasons.push(t('Incompatible with debiasing'))

        const disabled = disabledReasons.length > 0;
        const value = disabled ? false : control.value;
        return { disabled, value, disabledReasons }
      },
      dependents: ['optimization_presets', 'regression_quantile_low', 'regression_quantile_high', 'biased_groups']
    },
    regression_quantile_low: {
      description: t('If set, a higher bound with the set confidence (in percentage) is returned.'),
      shouldDisplayFunc: (controls) => controls?.quantile_mode?.value,
      mapStateToProps: (state, control) => { 
        const quantileMode = state?.controls?.quantile_mode?.value;
        let { value, default: defaultValue } = control;
        value = value ?? defaultValue;
        value = !quantileMode ? defaultValue : value;

        return { value }
      }
    },
    regression_quantile_high: {
      description: t('If set, a higher bound with the set confidence (in percentage) is returned.'),
      shouldDisplayFunc: (controls) => controls?.quantile_mode?.value,
      mapStateToProps: (state, control) => { 
        const quantileMode = state?.controls?.quantile_mode?.value;
        let { value, default: defaultValue } = control;
        value = value ?? defaultValue;
        value = !quantileMode ? defaultValue : value;

        return { value }
      }
    },
    cross_validation: {
      default: false,
      dependents: ['ratio', 'kfolds']
    },
    ratio: {
      description: t('The percentage of rows with non-empty predicted target that are used for validation of trained models (the rest are used for training).'),
      shouldDisplayFunc: controls => !controls?.cross_validation?.value || false
    },
    kfolds: {
      shouldDisplayFunc: controls => controls?.cross_validation?.value || false
    },
    option_regression: {
      class: 'hidden',
    },
    adhoc_filters: {
      description: t('If set, only rows that satisfy this condition are used for training and prediction.'),
    },
    treatment: {
      label: "Current intervention",
      mapStateToProps: (state) => ({ 
        options: getOptionsFromValue(state, 'all_columns').filter(column => column.column_name !== state.controls.state?.controls?.treatment?.value),
      }),
      dependents: ['common_causes', 'new_treatment'],
      validators: [],
    },
    new_treatment: {
      label: "New intervention",
      mapStateToProps: (state) => ({ 
        options: !state?.controls?.treatment?.value 
          ? []
          : exclusiveInterventionOptions(state, 'new_treatment'),
        disabled: !state?.controls?.treatment?.value,
      }),
      validators: [(value, state) => {
        if ((state?.controls?.treatment?.value?.length || 0) > 0) {
          return v.nonEmpty(value);
        }
        return false;
      }]
    },
    common_causes: {
      mapStateToProps: (state) => ({ 
        options: !state?.controls?.treatment?.value 
          ? []
          : getOptionsFromValue(state, 'all_columns').filter(column => ![state.controls.prediction.value, state.controls.treatment.value].includes(column.column_name)),
        disabled: !state?.controls?.treatment?.value,
      }),
    }
  },
};
