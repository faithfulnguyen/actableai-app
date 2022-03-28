export const DEFAULT_ORDER = [
  'clean_data', 'plotly_correlation', 'causal_inference', 'plotly_tsne', 'classification_prediction',
  'regression_prediction', 'plotly_prediction', 'bayesian_regression',
  'sentiment_analysis', 'plotly_bubble', 'anova', 'pie', 'plotly_bar', 'line', 'filter_box',
  'histogram', 'table', 'box_plot', 'pivot_table', 'paired_ttest', 'dual_line', 'line_multi',
  'sunburst', 'word_cloud', 'partition', 'directed_force', 'chord',
  'big_number_total', 'heatmap', 'iframe'
] as const;

export const numberTypes = ["DOUBLE PRECISION", "BIGINT"] as const;
export const dateTypes = ['DATE', 'TIMESTAMP WITHOUT TIME ZONE'] as const;
