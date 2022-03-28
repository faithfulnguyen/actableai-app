import React from 'react';
import { CHART_TYPE, MAIN_FACTOR_COLOR } from './shared';

interface IChartTitle {
  compareFactor: {
    col: any;
    corr: any;
  };
  chartType: string;
  formData: any;
}

function ChartTitle({ compareFactor, chartType, formData }: IChartTitle){
  const factor = formData.correlation_target;
  const factorValue = formData.correlation_target_value;
  const comparedFactorTitle = Array.isArray(compareFactor.col)
      ? compareFactor.col.join(': ')
      : compareFactor.col;
  const factorTitle = `${factor}${factorValue ? ': ' + factorValue : ''}`;
  const factorStyle: any = {};
  if (chartType === CHART_TYPE.CONFUSION_MATRIX) {
      factorStyle.color = MAIN_FACTOR_COLOR;
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontWeight: 600 }}>
        <span style={factorStyle}>{factorTitle}</span> {'VS'}{' '}
        {comparedFactorTitle}
      </p>
      <p>
        {`Spearman correlation: ${parseFloat(compareFactor.corr).toFixed(4)}`}
      </p>
    </div>
  );
}

export default ChartTitle;