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
import { nonEmpty } from '../validators';
import { categoricalTypes, getColumnDataType, getMutauallyExculusiveOptions } from './Utils';

const mutuallyExculsiveMultiDropdowns = ['columns_name'];
const mutuallyExculsiveDropdowns = ['correlation_target'];

const exclusiveOptions = (state, fieldName, whitelistTypes, blacklistTypes) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes, blacklistTypes);

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                ['adhoc_filters'],
                ['correlation_target'],
                ['correlation_target_value'],
                ['columns_name'],
                ['correlation_control'],
                ['number_factors'],
                ['show_bar_value'],
            ],
        },
    ],
    controlOverrides: {
        adhoc_filters: {
            description: t('Only filtered data are searched.'),
            // mapStateToProps: state => ({
            //     columns: state.datasource ? state.datasource.columns.filter((c) => {
            //         if (state.controls && state.controls.columns_name) {
            //             return state.controls.columns_name.value.includes(c.column_name);
            //         }
            //     }) : [],
            //     savedMetrics: state.datasource ? state.datasource.metrics : [],
            //     datasource: state.datasource,
            // }),
        },
        correlation_target: {
            mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'correlation_target', undefined, ["TEXT"]) }),
            dependents: ['correlation_target_value'],
        },
        correlation_target_value: {
          validators: [(value, state) => {
            if(state && categoricalTypes.includes(getColumnDataType(state.datasource, state.controls?.correlation_target?.value))) {
              return nonEmpty(value);
            }
            return false;
          }],
          clearable: false,
          shouldDisplayFunc: controls => {
            if(!controls?.datasource?.datasource) return false;
            return categoricalTypes.includes(getColumnDataType(controls.datasource.datasource, controls.correlation_target?.value))
          },
        },
        columns_values: {
            description: t('Choose a column to look for correlated factors.'),
        },
        columns_name: {
            description: t('Columns used to search for correlation with correlated factor.'),
            mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'columns_name') }),
        },
        number_factors: {
            description: t('Number of top correlated factors to be displayed.')
        },
    },
};
