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
import { getMutauallyExculusiveOptions, numericTypes } from './Utils';
import { dateTypes, numberTypes } from '../consts';

const mutuallyExculsiveMultiDropdowns = ['all_columns'];
const mutuallyExculsiveDropdowns = ['prediction'];

const exclusiveOptions = (state, fieldName, whitelistTypes) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes);

export default {
  label: t('Bayesian Linear Regression'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      description: '',
      controlSetRows: [
        ['prediction'],
        ['all_columns'],
        ['adhoc_filters'],
        ['polynomial_degree'],
        ['regression_quantile_low'],
        ['regression_quantile_high'],
        ['ratio'],
        ['num_trials'],
      ],
    },
    {
      customTab: true,
      label: t('Priors'),
      expanded: true,
      description: '',
      controlSetRows: [
        ['priors']
      ],
    },
  ],
  controlOverrides: {
    prediction: {
      description: t('The column to be predicted.'),
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'prediction', numericTypes) }),
    },
    all_columns: {
      label: t('Predictors'),
      description: t('Columns to be used to calculate our predictions.'),
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'all_columns').filter(option => !dateTypes.includes(option.type)) }),
      validators: [v.nonEmpty],
    },
    quantile_mode: {
      default: true,
      validators: [
        (value) => {
          const element_high = document.getElementById(
            'regression_quantile_high',
          );
          const element_low = document.getElementById(
            'regression_quantile_low',
          );
          if (element_high && element_low) {
            if (value) {
              element_high.style.display = 'block';
              element_low.style.display = 'block';
            } else {
              element_high.style.display = 'none';
              element_low.style.display = 'none';
            }
          }
        },
      ],
    },
    adhoc_filters: {
      description: t('If set, only rows that satisfy this condition are used for training and prediction.'),
    },
    ratio: {
      shouldDisplayFunc: (controls) => !controls?.cross_validation?.value || false
    },
    priors: {
      validators: [
        (value) => {
          return value.map(prior => prior && Object.keys(prior.errors).length)
            .filter(errorCount => errorCount !== 0).length !== 0
            && 'is not set properly';
        }
      ]
    }
  },
};

