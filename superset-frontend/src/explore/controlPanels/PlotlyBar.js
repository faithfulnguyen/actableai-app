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
import * as v from '../validators';

export default {
    controlPanelSections: [
        {
            label: t('Query'),
            expanded: true,
            controlSetRows: [
                ['metric'],
                ['adhoc_filters'],
                ['groupby'],
                ['columns'],
                ['row_limit'],
                ['show_stacked'],
                ['show_percentage'],
                ['show_error_bars'],
                ['horizontal_mode'],
            ],
        },
        {
            label: t('Chart Options'),
            expanded: true,
            controlSetRows: [
                ['color_scheme', 'label_colors'],
                ['show_legend', 'show_bar_value'],
            ],
        },
        {
            label: t('Axis Label'),
            expanded: true,
            controlSetRows: [
                ['x_axis_label'],
                ['y_axis_label'],
            ],
        },
    ],
    controlOverrides: {
        groupby: {
            label: t('Series'),
            validators: [v.nonEmpty],
        },
        columns: {
            label: t('Breakdowns'),
            description: t('Defines how each series is broken down'),
        },
    },
};
