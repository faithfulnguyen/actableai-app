type TAnalysisType =
  | 'cleandata'
  | 'correlation'
  | 'causal_inference'
  | 'tsne'
  | 'classification'
  | 'regression'
  | 'timeseries'
  | 'bayesian'
  | 'sentiment'
  | 'anova';

interface IFeature {
  feature: string;
  importance: number;
  importance_std_err: number;
}

interface IFieldData {
  name: string;
  type: 'string' | 'integer' | 'number';
}

interface IRegressionEvaluateDetails {
  MAE: number;
  R2: number;
  RMSE: number;
}

interface ITaskValidation {
  level: 'CRITICAL';
  message: string;
}

interface ITable {
  columns: string[];
  data: Record<string, any[]>;
  index?: number[] | undefined;
}

interface IValidationMetric {
  mean: number;
  metric: 'r2';
  stderr: number;
  values: number[]
}

interface IRegressionAnalysisData {
  evaluate: IRegressionEvaluateDetails;
  exdata?: Record<string, any>[];
  fields: IFieldData[];
  importantFeatures: IFeature[];
  predictData?: Record<string, any>[];
  predict_shaps: [];
  prediction_table: ITable;
  validation_shaps: [];
  validation_table: ITable;
  intervention_table: ITable;
  debiasing_charts: TDebiasingChart[];

}

interface ICausalInferenceEffect {
  'cate': number,
  'lb': number,
  'treatment_name': string,
  'treatment_value': any,
  'ub': number;
  [effectKey: string]: string | number;
}

interface ICausalInferenceData {
  causal_graph_dot: string;
  controls: {[key: string]: any};
  effect: ICausalInferenceEffect[];
  refutation_results: Record<string, any>,
  shap_values: [],
  tree_interpreter_dot: '',
  model_t_feature_importances: ITable;
  model_t_scores: IValidationMetric;
  model_y_feature_importances: ITable;
  model_y_scores: IValidationMetric;
  T_res: [number][];
  Y_res: [number][];
}

interface IBaseClassificationEvaluateDetails {
  accuracy: number;
  accuracy_std_err: number;
  confusion_matrix: number[][];
  confusion_matrix_std_err: number[][];
  labels: string[];
  problem_type: 'binary' | 'multiclass';
}

interface IBinaryClassificationEvaluateDetails extends IBaseClassificationEvaluateDetails {
  auc_curve: {
    'False Positive Rate': [number, number, number],
    'True Positive Rate': [number, number, number],
    negative_label: string,
    positive_label: string,
    threshold: number,
    thresholds: [number, number, number],
    TPR_stderr?: any;
    FPR_stderr?: any;
  },
  auc_score: number,
  auc_score_std_err: number;
  problem_type: 'binary';
}

interface IMultiClassClassificationEvaluationDetails extends IBaseClassificationEvaluateDetails {
  problem_type: 'multiclass'
}

type TClassificationEvaluationDetails =
  | IBinaryClassificationEvaluateDetails
  | IMultiClassClassificationEvaluationDetails;

type TDebiasingBarsChartData = {
  x: number[];
  name: string;
};

type TDebiasingLinesChartData = {
  y: number[];
  name: string;
};

type TDebiasingChartData = {
  x_label: string;
  corr: number;
  pvalue: number;
  x?: number[];
  y?: number[];
  bars?: TDebiasingBarsChartData[];
  lines?: TDebiasingLinesChartData[];
};

type TDebiasingChart = {
  type: string;
  group: string;
  target: string;
  charts: TDebiasingChartData[];
};

interface IClassificationAnalysisData<TEvaluate extends TClassificationEvaluationDetails> {
  evaluate: TEvaluate;
  exdata: {
    [key: string]: any;
    __probability__: number;
  }[];
  fields?: {
    name: string;
    type: string;
  }[];
  importantFeatures: IFeature[];
  predictData?: Record<string, any>[];
  prediction_table: ITable;
  predict_explanations: [];
  validation_explanations: [];
  validation_table: ITable;
  cross_validation_exdata: Record<string, any>[][];
  debiasing_charts: TDebiasingChart[];
}

type ISegmentationAnalysisData = {
  cluster_id: number;
  value: {
    train: {
      x: number;
      y: number;
    };
    column: Record<string, any>;
    explaination: any;
    index: number;
  }[]
}[];

type TAnalysisResult =
  | IRegressionAnalysisData
  | ICausalInferenceData
  | IClassificationAnalysisData<TClassificationEvaluationDetails>
  | ISegmentationAnalysisData;

type TStatus = 'SUCCESS' | 'PENDING' | 'FAILURE' | 'PROCESSING' | 'INIT PROCESSING' | 'WRITTEN' | 'RETRY' | 'REVOKED';

interface ITaskDetails<TData extends TAnalysisResult> {
  data: TData;
  messenger: string;
  runtime: number;
  status: TStatus;
  validations: ITaskValidation[];
  table: Record<string, Record<number, any>>;
}

type IColumnDataType = 'BIGINT' | 'DOUBLE PRECISION' | 'VARCHAR' | 'REAL' | 'TEXT' | 'DATE' | 'UNKNOWN' | 'STRING' | 'CHAR' |'BOOLEAN' |'loading';

interface IColumnInfo {
  type: IColumnDataType;
  column: string;
  disabled?: boolean;
}

type ValueType<TValue = string> = {
  label: string;
  value: TValue;
} | null;


interface IBaseRuleStatementPart {
    column: ValueType;
    operator: ValueType;
  }

type TMisplacedStatement = IBaseRuleStatementPart & {
    isRegex: boolean;
    value: string;
  };

type TValidationStatementPart = IBaseRuleStatementPart & {
    comparedColumn: ValueType;
  }

interface IValidationRuleStatement {
    when: TValidationStatementPart[];
    then: TValidationStatementPart[];
  }

interface IImputationRule {
    title: string;
    validations: IValidationRuleStatement[];
    misplaced: TMisplacedStatement[];
}

interface IImputationRuleForm {
  rule?: any;
  isEdit: boolean;
}

interface ISheetImputationRules {
  [key: string]: IImputationRule;
}

interface IAddonUser {
  leftTime: number;
  plan_name: string;
  email: string;
}

interface ITimeseriesAnalysisData {
  predict: [{
      name: string,
      value: {
        data: {
          date: string[],
          value: number[],
        },
        prediction: {
          date: string[],
          min: number[],
          median: number[],
          max: number[],
        }
      }
  }[]],
  evaluate: {
    dates: string[],
    values: [
      [
        {
          q5: number[],
          q50: number[],
          q95: number[]
        },
      ]
    ],
    agg_metrics: Record<string, any>,
    item_metrics: {
      item_id: Record<string, any>,
      MSE: Record<string, any>,
      abs_error: Record<string, any>,
      abs_target_sum: Record<string, any>,
      abs_target_mean: Record<string, any>,
      seasonal_error: Record<string, any>,
      MASE: Record<string, any>,
      MAPE: Record<string, any>,
      sMAPE: Record<string, any>,
      OWA: Record<string, any>,
      MSIS: Record<string, any>,
      'QuantileLoss[0.1]': Record<string, any>,
      'Coverage[0.1]': Record<string, any>,
      'QuantileLoss[0.5]': Record<string, any>,
      'Coverage[0.5]': Record<string, any>,
      'QuantileLoss[0.95]': Record<string, any>,
      'Coverage[0.95]': Record<string, any>,
    }
  }
}
