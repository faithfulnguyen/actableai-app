declare module 'react-elastic-carousel';
declare module 'distributions-normal-quantile';

interface IState {
  can_add: boolean;
  can_download: boolean;
  can_overwrite: boolean;
  common: IStateCommons;
  controls: Record<string, Record<string, any>>;
  datasource: IDatasource;
  datasource_id: number;
  datasource_type: string;
  slice?: any;
  standalone: boolean;
  user_id: string;
  forced_height?: any;
  has_admin_role: boolean;
  user_email: string;
  filterColumnOpts: any[];
  isDatasourceMetaLoading: boolean;
  isStarred: boolean;
}

interface IStateCommons {
  flash_messages: any[];
  conf: IStateCommonsConf;
}

interface IStateCommonsConf {
  SUPERSET_WEBSERVER_TIMEOUT: number;
  SUPERSET_DASHBOARD_POSITION_DATA_LIMIT: number;
  ENABLE_JAVASCRIPT_CONTROLS: boolean;
  DEFAULT_SQLLAB_LIMIT: number;
  SQL_MAX_ROW: number;
  SUPERSET_WEBSERVER_DOMAINS?: any;
  SQLLAB_SAVE_WARNING_MESSAGE?: any;
  DISPLAY_MAX_ROW: number;
}

interface IDatasource {
  id: number;
  column_formats: IDatasourceColumnFormats;
  description?: any;
  database: IDatasourceDatabase;
  default_endpoint?: any;
  filter_select: boolean;
  filter_select_enabled: boolean;
  name: string;
  datasource_name: string;
  type: string;
  schema?: any;
  offset: number;
  cache_timeout?: any;
  params?: any;
  perm: string;
  edit_url: string;
  sql?: any;
  columns: IDatasourceColumn[];
  metrics: IDatasourceMetric[];
  order_by_choices: string[][];
  owners: any[];
  verbose_map: IDatesourceVerboseMap;
  select_star: string;
  granularity_sqla: any[];
  time_grain_sqla?: (null | string);
  main_dttm_col?: any;
  fetch_values_predicate?: any;
  template_params?: any;
  columns_positive: string[];
  columns_name: string[];
  columns_values: IDatasourceColumnsValue[];
  group_values: IDatasourceGroupValues;
}

interface IDatasourceGroupValues {
  [key: string]: IValueType[];
}

interface IValueType {
  label: string;
  value: string;
}

interface IDatasourceColumnsValue {
  column: string;
  value?: string;
}

interface IDatesourceVerboseMap {
  __timestamp: string;
  count: string;
  number_of_rooms: string;
  number_of_bathrooms: string;
  sqft: string;
  location: string;
  days_on_market: string;
  initial_price: string;
  neighborhood: string;
  rental_price: string;
}

interface IDatasourceMetric {
  id: number;
  metric_name: string;
  verbose_name: string;
  description?: any;
  expression: string;
  warning_text?: any;
  d3format?: any;
}

type IDatasourceColumnType = 'BIGINT' | 'DOUBLE PRECISION' | 'VARCHAR' | 'STRING' | 'CHAR' | 'TEXT' | 'BOOLEAN';

interface IDatasourceColumn {
  id: number;
  column_name: string;
  verbose_name?: any;
  description?: any;
  expression?: any;
  filterable: boolean;
  groupby: boolean;
  is_dttm: boolean;
  type: IDatasourceColumnType;
}

interface IDatasourceDatabase {
  id: number;
  name: string;
  backend: string;
  allow_multi_schema_metadata_fetch: boolean;
  allows_subquery: boolean;
  allows_cost_estimate: boolean;
}

interface IDatasourceColumnFormats {
}



interface IPrior {
  columnName: string;
  columnValue: string;
  polynomialDegree: number;
  isCategorical: boolean;
  priorValue: number;
  errors: Record<string, string>;
}

interface FullAnalysis {
  name: string;
  mean: number;
  stds: number;
  pdfs: number[][][];
  analysis: {
    x: number[];
    coeffs: number[];
    stds: number[];
    pdfs: any[];
    y_mean: number[];
    y_std: number;
    r2: number[];
    rmse: number[];
  }
}
