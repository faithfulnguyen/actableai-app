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

let columns = [];
let date_value = null;

export default {
  label: t('Prediction Chart'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['date_time'],
        ['all_columns'],
        ['adhoc_filters'],
        ['prediction_day',null],
        ['num_trials'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        ['show_legend', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'left_margin'],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        ['y_axis_label', 'bottom_margin'],
      ],
    },
  ],
  controlOverrides: {
    date_time: {
      description: t('The column whose values are dates or datetimes for corresponding rows.'),
      mapStateToProps: (state, control) => {
        date_value = control.value;
        const newState = {};
        const type = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMP WITHOUT TIME ZONE'];
        if (state.datasource) {
          newState.options = state.datasource.columns.filter(c => type.includes(c.type));
          if (control && control.includeTime) {
            newState.options.push(timeColumnOption);
          }
        }
        return newState;
      },
    },
    all_columns: {
      description: t('The columns are used for the forecast.'),
      mapStateToProps: (state, control) => {
        const datasource = (state.datasource) ? state.datasource.columns.filter(x=>x.column_name!=date_value) : [];
        columns = datasource.map(x=>x.column_name);
        if(state.controls!==undefined && state.controls.all_columns!==undefined){
          const optionValue = state.controls.all_columns.value.filter(x=>x!=date_value);
          state.controls.all_columns.value = optionValue;
        }
        return {
          options: datasource,
          default: columns,
        }
      },
      validators: [v.nonEmpty],
    },
    option_timeseries: {
      class: 'hidden',
    },
    epochs: {
      class: 'hidden',
    },
    num_cells: {
      class: 'hidden',
    },
    num_layers: {
      class: 'hidden',
    },
    dropout_rate: {
      class: 'hidden',
    },
    learning_rate: {
      class: 'hidden',
    },
    num_trials: {
      // class: 'hidden',
      description: t('The number of models to be trained. The best model based on validation data will be chosen to generate the final forecast. More trials usually result in better forecast but take longer to train.'),
    },
    color_scheme: {
      renderTrigger: true,
    },
    prediction_day: {
      label: t('Prediction length'),
      description: t('How many steps in the future will be forecasted.'),
    },
    adhoc_filters: {
      description: t('Only filtered data are forecasted.'),
    }
  },
};
