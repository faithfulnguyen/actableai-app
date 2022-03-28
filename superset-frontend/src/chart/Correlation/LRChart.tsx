import { Data, Layout } from 'plotly.js';
import React from 'react';
import Plot from 'react-plotly.js';
import { CONFIDENCE_LEVEL_FACTOR, responsiveStyle, round } from './shared';

interface ILRChartProps {
  chartData: any;
  index: number;
}

function LRChart({ chartData, index }: ILRChartProps) {
  const data = chartData.data || {};
  const low_quantiles = data.y_std.map((value: number, yIdx: number) => {
      return data.y_mean[yIdx] - value * CONFIDENCE_LEVEL_FACTOR;
  });

  const high_quantiles = data.y_std.map((value: number, yIdx: number) => {
      return data.y_mean[yIdx] + value * CONFIDENCE_LEVEL_FACTOR;
  });

  const trace2: Data = {
      name: '95% regression quantile',
      type: 'scatter',
      x: data.x_pred,
      y: high_quantiles,
      fill: 'tonexty',
      line: { color: 'rgba(196, 196, 196, 0.88)' },
  };

  const trace1: Data = {
      name: '5% regression quantile',
      type: 'scatter',
      x: data.x_pred,
      y: low_quantiles,
      line: { color: 'rgba(196, 196, 196, 0.88)' },
  };

  const trace3: Data = {
      name: 'Regression',
      type: 'scatter',
      x: data.x_pred,
      y: data.y_mean,
  };

  const trace4: Data = {
      mode: 'markers',
      name: 'Data points',
      type: 'scatter',
      x: data.x,
      y: data.y,
  };

  const traces: Data[] = [trace1, trace2, trace3, trace4];
  const layout: Partial<Layout> = {
      xaxis: {
          title: data['x_label'],
          titlefont: {},
      },
      yaxis: {
          title: data['y_label'],
          titlefont: {},
      },
      autosize: true,
      annotations: [
          {
              text: ` R2 score: ${round(data.r2, 2)}`,
              align: 'left',
              showarrow: false,
              xref: 'paper',
              yref: 'paper',
              xanchor: 'left',
              x: 1.05,
              y: 0.1,
              bordercolor: 'black',
              borderwidth: 1,
          },
      ],
  };

  return (
    <Plot
      key={index}
      data={traces}
      layout={layout}
      style={responsiveStyle}
    />
  );
}

export default LRChart;
