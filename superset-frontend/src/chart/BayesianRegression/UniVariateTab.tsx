import React from 'react';
import { DensityPlot } from './DensityPlot';
import LRChart from './LRChart';

interface UniVariateTabProps {
  coeffs: {
    univariate: FullAnalysis[];
    multivariate: FullAnalysis[];
  };
  table: {
    data: any[];
  };
  formData: {
    prediction: string;
    regression_quantile_low: number;
    regression_quantile_high: number;
  }
}

function UniVariateTab({ coeffs, table, formData }: UniVariateTabProps) {
  let containers = [];
  // console.log(coeffs.univariate)
  for (let i = 0; i < coeffs.univariate.length; i++) {
    if (coeffs.univariate[i].name in table.data) {
      containers.push(
        <LRChart
          data={{
            x: table.data[coeffs.univariate[i].name],
            y: table.data[formData.prediction],
            r2: coeffs.univariate[i].analysis.r2,
            x_title: coeffs.univariate[i].name,
            y_title: formData.prediction,
          }}
          x={coeffs.univariate[i].analysis.x}
          y_mean={coeffs.univariate[i].analysis.y_mean}
          y_std={coeffs.univariate[i].analysis.y_std}
          quantile_low={formData.regression_quantile_low}
          quantile_high={formData.regression_quantile_high}
        />
      )

      for (let j = 0; j < coeffs.univariate[i].analysis.pdfs.length; j++) {
        containers.push(
          <DensityPlot
            analysis={coeffs.univariate[i]}
            title={coeffs.univariate[i].name + (j==0? "":"^" + (j + 1))}
            isUnivariate
            univariateIndex={j}
          />
        );
      }
    }
  };

  return (
    <>
      {containers}
    </>
  );
}

export default UniVariateTab;
