import React from 'react';
import Plot from 'react-plotly.js';
import { responsiveStyle } from './shared';
import quantile from 'distributions-normal-quantile';
import { Data, Layout } from 'plotly.js';

interface ILRChartProps {
  data: any;
  x: number[];
  y_mean: number[];
  y_std: number;
  quantile_low: number;
  quantile_high: number;
}

function LRChart({ data, x, y_mean, y_std, quantile_low, quantile_high }: ILRChartProps) {
  const low_quantiles = [];
  const high_quantiles = [];
  for (var i = 0; i < y_mean.length; i++) {
    let quantiles = quantile([quantile_low/100., quantile_high/100.], {
      'mu': y_mean[i],
      'sigma': y_std[i],
    });
    low_quantiles.push(quantiles[0]);
    high_quantiles.push(quantiles[1]);
  }

  const trace2: Data = {
    name: quantile_high + '% quantile',
    type: 'scatter',
    x: x,
    y: high_quantiles,
    fill: 'tonexty',
    line: { color: 'rgba(196, 196, 196, 0.88)' },
  };

  const trace1: Data = {
    name: quantile_low + '% quantile',
    type: 'scatter',
    x: x,
    y: low_quantiles,
    line: { color: 'rgba(196, 196, 196, 0.88)' },
  };

  const trace3: Data = {
    name: 'Regression',
    type: 'scatter',
    x: x,
    y: y_mean,
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
      title: data.x_title,
      titlefont: {},
    },
    yaxis: {
      title: data.y_title,
      titlefont: {},
    },
    autosize: true,
    annotations: [
      {
        text: `R2 score: ${data.r2}`,
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
      data={traces}
      layout={layout}
      style={responsiveStyle}
    />
  );
}

export default LRChart;
