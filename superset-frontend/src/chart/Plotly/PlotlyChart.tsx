import React from 'react';
import PlotlyBubble from 'src/chart/Plotly/PlotlyBubble';
import PlotlyPrediction from 'src/chart/Plotly/PlotlyPrediction';
import PlotlyBar from 'src/chart/Plotly/PlotlyBar';
import ClassificationChart from 'src/chart/Classification/ClassificationChart';
import BayesianRegressionChart from 'src/chart/BayesianRegression/BayesianRegressionChart';
import CustomTable from 'src/chart/Custom/CustomTable';
import CleanData from 'src/chart/Custom/CleanData';
import SentimentAnalysis from 'src/chart/Custom/Sentiment';
import AnovaChart from '../Custom/Anova';
import RegressionChart from '../Regression/RegressionChart';
import SegmentationChart from '../Segmentation/SegmentationChart';
import CausalInferenceChart from '../CausalInference/CausalInferenceChart';
import CorrelationChart from '../Correlation/CorrelationChart';

const charts = {
  'plotly_bubble': PlotlyBubble,
  'plotly_prediction': PlotlyPrediction,
  'plotly_correlation': CorrelationChart,
  'plotly_bar': PlotlyBar,
  'classification_prediction': ClassificationChart,
  'regression_prediction': RegressionChart,
  'sentiment_analysis': SentimentAnalysis,
  'table': CustomTable,
  'plotly_tsne': SegmentationChart,
  'clean_data': CleanData,
  'causal_inference': CausalInferenceChart,
  'anova': AnovaChart,
  'bayesian_regression': BayesianRegressionChart,
}

interface IPlotlyChartProps {
  annotationData: Record<string, any>;
  actions?: Record<string, any>;
  chartId: number;
  datasource: Record<string, any>;
  initialValues?: Record<string, any>;
  formData: Record<string, any>;
  height?: number;
  width?: number;
  setControlValue?: () => void;
  vizType: string;
  triggerRender?: Boolean;
  // state
  chartAlert?: string;
  chartStatus?: string;
  queryResponse?: Record<string, any>;
  triggerQuery?: Boolean;
  refreshOverlayVisible?: Boolean;
  // dashboard callbacks
  addFilter?: () => void;
}

function PlotlyChart ({ vizType, ...rest}: IPlotlyChartProps) {
  // eslint-disable-next-line consistent-return
  const ChartComponent = charts[vizType] || (() => <></>);

  return (
    <ChartComponent {...{ vizType, ...rest}} />
  );
};

export default PlotlyChart;
