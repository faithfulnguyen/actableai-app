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
import ColumnOption from "src/components/ColumnOption";
import React from "react";

const checkMetricsValue = (controls) => {
  if(controls && controls.metrics && controls.metrics.value){
    return controls.metrics.value.length > 0
  }
  if(controls && controls.percent_metrics && controls.percent_metrics.value){
    return controls.percent_metrics.value.length > 0;
  }
};

const checkOrdering = (controls) => {
  if (controls && (controls.metrics || controls.percent_metrics) && controls.dictint) {
    if (!checkMetricsValue(controls)) {
      return !!controls.dictint.value;
    } else {
      return true;
    }
  }
};

const checkSortBy = (controls) => {
  if (controls && (controls.metrics || controls.percent_metrics) && controls.dictint) {
    if (!checkMetricsValue(controls)) {
      return !controls.dictint.value;
    } else {
      return false;
    }
  }
};

let columns = [];

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      description: t('Use this section if you want a query that aggregates'),
      expanded: true,
      controlSetRows: [
        ['all_columns'],
        ['dictint'],
        ['metrics'],
        ['groupby'],
        ['percent_metrics'],
        ['order_by'],
        ['order_desc'],
        ['row_limit'],
        ['include_time'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        ['table_timestamp_format'],
        ['page_length', null],
        ['include_search', 'table_filter'],
        ['align_pn', 'color_pn'],
      ],
    },
  ],
  controlOverrides: {
    all_columns: {
      mapStateToProps: (state) => {
        const datasource = (state.datasource) ? state.datasource.columns : [];
        columns = datasource.map(x=>x.column_name);
        return {
          options: datasource,
          default: columns,
        }
      },
    },
    metrics: {
      validators: [],
      type: 'MetricsControlCustom',
      mapStateToProps: (state) => {
        const datasource = state.datasource;
        return {
          columns: datasource ? datasource.columns : [],
          savedMetrics: [],
          datasourceType: datasource && datasource.type,
          order_by: state.controls ? state.controls.order_by : [],
          control: state.controls ? state.controls.percent_metrics : [],
          dictint: state.controls ? state.controls.dictint : false,
        };
      }
    },
    percent_metrics: {
      type: 'MetricsControlCustom',
      mapStateToProps: (state) => {
        const datasource = state.datasource;
        return {
          columns: datasource ? datasource.columns : [],
          savedMetrics:[],
          datasourceType: datasource && datasource.type,
          order_by: state.controls ? state.controls.order_by : [],
          control: state.controls ? state.controls.metrics : [],
          dictint: state.controls ? state.controls.dictint : [],
        };
      }
    },
    dictint: {
      mapStateToProps: state => ({
        hidden: checkMetricsValue(state.controls),
      }),
    },
    order_desc: {
      label: t('Order Descending')
    },
    order_by: {
      mapStateToProps: (state) => {
        if(checkOrdering(state.controls)) {
          return {
            type: 'MetricsControl',
            label: t('Order By'),
            default: null,
            description: t('Metric used to define the top series'),
            columns: state.datasource ? state.datasource.columns : [],
            savedMetrics: state.datasource ? state.datasource.metrics : [],
            datasourceType: state.datasource && state.datasource.type,
          }
        } else if (checkSortBy(state.controls)) {
          return {
            type: 'SelectControl',
            multi: true,
            label: t('Order By'),
            default: [],
            description: t('Columns to display'),
            optionRenderer: c => <ColumnOption column={c} showType />,
            valueRenderer: c => <ColumnOption column={c} />,
            valueKey: 'column_name',
            allowAll: true,
            options: (state.datasource) ? state.datasource.columns : [],
            commaChoosesOption: false,
            freeForm: true,
          }
        }
      }
    }
  },
};
