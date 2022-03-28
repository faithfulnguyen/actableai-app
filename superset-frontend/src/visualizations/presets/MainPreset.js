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
import { Preset } from '@superset-ui/core';
import {
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
} from '@superset-ui/legacy-preset-chart-big-number';
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';
import ForceDirectedChartPlugin from '@superset-ui/legacy-plugin-chart-force-directed';
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import PivotTableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import SunburstChartPlugin from '@superset-ui/legacy-plugin-chart-sunburst';
import TableChartPlugin from '@superset-ui/legacy-plugin-chart-table';
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';
import WordCloudChartPlugin from '@superset-ui/legacy-plugin-chart-word-cloud';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
// There is a known issue with bubble chart that the bubbles will not show up.
// (<path d="NaN" />)
// Make sure to import '@superset-ui/legacy-preset-chart-nvd3/lib'
// Not '@superset-ui/legacy-preset-chart-nvd3',
// which will point to '@superset-ui/legacy-preset-chart-nvd3/esm' by default
import {
  AreaChartPlugin,
  BarChartPlugin,
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  DistBarChartPlugin,
  DualLineChartPlugin,
  LineChartPlugin,
  LineMultiChartPlugin,
  PieChartPlugin,
  TimePivotChartPlugin,
} from '@superset-ui/legacy-preset-chart-nvd3';
import { BoxPlotChartPlugin } from '@superset-ui/preset-chart-xy/esm/legacy';
import { DeckGLChartPreset } from '@superset-ui/legacy-preset-chart-deckgl';

import FilterBoxChartPlugin from '../FilterBox/FilterBoxChartPlugin';
import TimeTableChartPlugin from '../TimeTable/TimeTableChartPlugin';
import PlotlyBubbleChartPlugin from '../Plotly/Bubble/PlotlyBubbleChartPlugin';
import PlotlyPredictionChartPlugin from '../Plotly/Prediction/PlotlyPredictionChartPlugin';
import PlotlyCorrelationChartPlugin from '../Plotly/PlotlyCorrelation/PlotlyCorrelationChartPlugin';
import PlotlyBarChartPlugin from '../Plotly/Bar/PlotlyBarChartPlugin';
import ClassificationPredictionChartPlugin from '../Custom/Classification/ClassificationPredictionChartPlugin';
import RegressionPredictionChartPlugin from '../Custom/Regression/RegressionPredictionChartPlugin';
import CustomTableChartPlugin from '../Custom/Table/CustomTableChartPlugin';
import PlotlyTsneChartPlugin from '../Plotly/Tsne/PlotlyTsneChartPlugin';
import CleanDataChartPlugin from '../Custom/Clean/CleanDataChartPlugin';
import SentimentAnalysisPlugin from '../Custom/Sentiment/SentimentAnalysisPlugin';
import CausalInferencePlugin from '../Custom/CausalInference/CausalInferencePlugin';
import AnovaChartPlugin from '../Custom/Anova/AnovaChartPlugin';
import BayesianRegressionPlugin from '../Custom/BayesianRegression/RegressionPredictionChartPlugin';

let selector = null;
selector = document.getElementById('app');
if (selector === null) {
  selector = document.getElementById('data-bootstrap');
}
const selectorBootstrapData = selector.getAttribute('data-bootstrap');
const bootstrapData = (!selector || !selectorBootstrapData)
  ? []
  : JSON.parse(selectorBootstrapData);

const env = bootstrapData.env ? bootstrapData.env : [];

export default class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [
        //new DeckGLChartPreset(),
      ],
      plugins: [
        new CleanDataChartPlugin().configure({ key: 'clean_data' }),
        new RegressionPredictionChartPlugin().configure({ key: 'regression_prediction' }),
        new AnovaChartPlugin().configure({ key: 'anova' }),
        new BayesianRegressionPlugin().configure({ key: 'bayesian_regression' }),
        new ClassificationPredictionChartPlugin().configure({ key: 'classification_prediction' }),
        new PlotlyTsneChartPlugin().configure({ key: 'plotly_tsne' }),
        new PlotlyPredictionChartPlugin().configure({ key: 'plotly_prediction' }),
        new PlotlyBubbleChartPlugin().configure({ key: 'plotly_bubble' }),
        new PlotlyCorrelationChartPlugin().configure({ key: 'plotly_correlation' }),
        new ForceDirectedChartPlugin().configure({ key: 'directed_force' }),
        //new SankeyChartPlugin().configure({ key: 'sankey' }),
        new SunburstChartPlugin().configure({ key: 'sunburst' }),
        new SentimentAnalysisPlugin().configure({ key: 'sentiment_analysis' }),
        new CausalInferencePlugin().configure({ key: 'causal_inference' }),
        new ChordChartPlugin().configure({ key: 'chord' }),
        new PlotlyBarChartPlugin().configure({ key: 'plotly_bar' }),
        new WordCloudChartPlugin().configure({ key: 'word_cloud' }),
        new LineChartPlugin().configure({ key: 'line' }),
        new HistogramChartPlugin().configure({ key: 'histogram' }),
        new CustomTableChartPlugin().configure({ key: 'table' }),
        new BoxPlotChartPlugin().configure({ key: 'box_plot' }),
        new PairedTTestChartPlugin().configure({ key: 'paired_ttest' }),
        new PivotTableChartPlugin().configure({ key: 'pivot_table' }),
        //new RoseChartPlugin().configure({ key: 'rose' }),
        new FilterBoxChartPlugin().configure({ key: 'filter_box' }),
        //new EventFlowChartPlugin().configure({ key: 'event_flow' }),
        new PartitionChartPlugin().configure({ key: 'partition' }),
        //new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
        //new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        //new AreaChartPlugin().configure({ key: 'area' }),
        //new BarChartPlugin().configure({ key: 'bar' }),
        //new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        //new BubbleChartPlugin().configure({ key: 'bubble' }),
        //new BulletChartPlugin().configure({ key: 'bullet' }),
        //new CalendarChartPlugin().configure({ key: 'cal_heatmap' }),
        //new CompareChartPlugin().configure({ key: 'compare' }),
        //new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new DualLineChartPlugin().configure({ key: 'dual_line' }),
        new HeatmapChartPlugin().configure({ key: 'heatmap' }),
        //new HorizonChartPlugin().configure({ key: 'horizon' }),
        new IframeChartPlugin().configure({ key: 'iframe' }),
        new LineMultiChartPlugin().configure({ key: 'line_multi' }),
        //new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        //new MarkupChartPlugin().configure({ key: 'markup' }),
        //new MarkupChartPlugin().configure({ key: 'separator' }),
        //new ParallelCoordinatesChartPlugin().configure({ key: 'para' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        //new TimeTableChartPlugin().configure({ key: 'time_table' }),
        //new TreemapChartPlugin().configure({ key: 'treemap' }),
        //new WorldMapChartPlugin().configure({ key: 'world_map' }),
      ],
    });
  }
}
