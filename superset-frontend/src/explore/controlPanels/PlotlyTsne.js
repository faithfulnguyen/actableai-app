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
import { formatSelectOptions } from '../../modules/utils';
import { isAutoOrNumGreater1, greater0, nonEmpty } from '../validators';
import { detectIntWithNanColumns, getMutauallyExculusiveOptions } from './Utils';

let columns = [];
let clusters = 0;

const mutuallyExculsiveMultiDropdowns = ['all_columns', 'extra_columns'];
const mutuallyExculsiveDropdowns = ['group'];

const exclusiveOptions = (state, fieldName) => getMutauallyExculusiveOptions(
  state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns);

export default {
  label: t('Tsne Chart'),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['number_clusters', null],
        ['group'],
        ['adhoc_filters'],
        ['all_columns'],
        ['extra_columns'],
        ['hover'],
        ['explain_predictions'],
        ['max_train_samples'],
        ['max_bubble_size'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
      ],
    },
    // {
    //   label: t('X Axis'),
    //   expanded: true,
    //   controlSetRows: [
    //     ['x_axis_label', 'left_margin'],
    //   ],
    // },
    // {
    //   label: t('Y Axis'),
    //   expanded: true,
    //   controlSetRows: [
    //     ['y_axis_label', 'bottom_margin'],
    //   ],
    // },
  ],
  controlOverrides: {
    adhoc_filters: {
      description: t('Only filtered data points are segmented.')
    },
    number_clusters: {
      default: 8,
      validators: [
        nonEmpty,
        isAutoOrNumGreater1,
      ],
      description: t('This is the number of clusters to be created, similar data points are grouped into the same cluster.'),
      mapStateToProps: (state) => {
        if(state.controls!==undefined && state.controls.number_clusters!==undefined){
          clusters = state.controls.number_clusters.value;
        }
      },
    },
    group: {
      label: t('Colour'),
      description: t('The column used to set colours for displayed data points.'),
      validators: [
        nonEmpty,
      ],
      default: "cluster_id",
      mapStateToProps: (state) => {
        let datasource = (state.datasource) ? state.datasource.columns.filter(x=>x.id!==0) : [];
        return {
          options: [{
            id: 0,
            column_name: "cluster_id",
            verbose_name: null,
            description: null,
            expression: "Display colour group by number of clusters",
            filterable: true,
            groupby: true,
            is_dttm: false,
            type: null,
          }, ...datasource],
        }
      },
    },
    extra_columns: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'extra_columns') }),
    },
    max_bubble_size: {
      label: t('Size'),
      default: '5',
      renderTrigger: true,
      choices: formatSelectOptions(['3', '4','5', '6', '7', '8', '9', '10']),
      description: t('The radius of displayed data points.')
    },
    all_columns: {
      label: "Selected Features",
      description: t("Features that are used in the segmentation."),
      validators: [
        nonEmpty,
      ],
      mapStateToProps: (state) => {
        var columns = exclusiveOptions(state, "all_columns");
        columns = columns.filter(
          c => c.type !== null && (c.type.includes("DOUBLE") || c.type === "BIGINT" || c.type.includes("VARCHAR")));
        const col_names = columns.map(x => x.column_name);
        return {
          options: columns,
          default: col_names,
        }
      },
    },
    hover: {
      description: t('These column values will be displayed when hovering over a data point.')
    }
  },
};
