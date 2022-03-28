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
import { formatSelectOptions } from '../../modules/utils';
import React from 'react';
import * as v from '../validators';
import ColumnOption from 'src/components/ColumnOption';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metrics'], ['adhoc_filters'], ['groupby'], ['limit']],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        [
          {
            name: 'whisker_options',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Whisker/outlier options'),
              default: 'Tukey',
              description: t(
                'Determines how whiskers and outliers are calculated.',
              ),
              choices: formatSelectOptions([
                'Tukey',
                'Min/max (no outliers)',
                '2/98 percentiles',
                '9/91 percentiles',
              ]),
            },
          },
          'x_ticks_layout',
        ],
      ],
    },
  ],
  controlOverrides: {
    metrics: {
      type: 'SelectControl',
      multi: true,
      label: "Columns",
      description: "One or many columns to display",
      optionRenderer: c => <ColumnOption column={c} showType />,
      valueRenderer: c => <ColumnOption column={c} />,
      valueKey: 'column_name',
      default: [],
      mapStateToProps: state => ({
        options: state.datasource ? state.datasource.columns : [],
      }),
      validators: [v.nonEmpty],
    },
  }
};
