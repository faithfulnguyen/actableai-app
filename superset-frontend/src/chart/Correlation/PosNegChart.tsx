import _ from 'lodash';
import { Data, Layout } from 'plotly.js';
import React from 'react';
import Plot from 'react-plotly.js';
import { responsiveStyle } from './shared';

interface IPosNegChartProps {
  formData: any;
  chartData: any;
}

function PosNegChart({ formData, chartData }: IPosNegChartProps) {
  const { show_bar_value } = formData;
  // Init data
  let xPositive: any[] = [];
  let xNegative: any[] = [];
  let positive: any[] = [];
  let negative: any[] = [];
  let textPositive: any[] = [];
  let textNegative: any[] = [];
  const correlationData = chartData.data.corr || [];
  
  correlationData.forEach((data: any) => {
    if (data.corr > 0) {
      positive.push({
        key: data.col,
        value: data.corr,
      });
    } else {
      negative.push({
        key: data.col,
        value: data.corr,
      });
    }
  });
  
  // Get negative & positive value
  negative = _.sortBy(negative, 'value');
  positive = _.reverse(_.sortBy(positive, 'value'));
  negative = _.take(negative, formData.number_factors);
  positive = _.take(positive, formData.number_factors);
  negative.forEach(value => {
    xNegative.push(value.value);
    textNegative.push(value.key);
  });
  positive.forEach(value => {
    xPositive.push(value.value);
    textPositive.push(value.key);
  });
  // Get annotations
  const yNegative: any[] = [];
  const yPositive: any[] = [];
  let yCount1 = 1;
  let yCount2 = 1;
  xNegative.forEach(() => {
    yNegative.push(yCount1);
    yCount1 += 1;
  });
  xPositive.forEach(() => {
    yPositive.push(yCount2);
    yCount2 += 1;
  });
  const annotationsNegative: any[] = [];
  const annotationPositive: any[] = [];
  textNegative.forEach((value, index) => {
    annotationsNegative.push({
      x: -0.001,
      y: yNegative[index] - 0.5,
      xref: 'x',
      yref: 'y',
      xanchor: 'right',
      text: `${value}`,
      showarrow: false,
      font: {
        color: '#000000',
      },
    });
  });
  textPositive.forEach((value, index) => {
    annotationPositive.push({
      x: 0.001,
      y: yPositive[index] - 0.5,
      xref: 'x',
      yref: 'y',
      xanchor: 'left',
      text: `${value}`,
      showarrow: false,
      font: {
        color: '#000000',
      },
    });
  });
  const annotations = [...annotationPositive, ...annotationsNegative];
  const data: Data[] = [
    {
      x: xPositive,
      y: yPositive,
      text: show_bar_value ? xPositive : [],
      base: 0,
      type: 'bar',
      marker: { color: '#006BA4' },
      orientation: 'h',
      name: 'Positive',
      textposition: 'auto',
      hoverinfo: 'none',
      width: 0.4,
    } as Data,
    {
      x: xNegative,
      y: yNegative,
      text: show_bar_value ? xNegative : [],
      base: 0,
      type: 'bar',
      marker: { color: '#FF800E' },
      orientation: 'h',
      textposition: 'auto',
      hoverinfo: 'none',
      name: 'Negative',
      width: 0.4,
    } as Data,
  ];
  
  const layout: Partial<Layout> = {
    hovermode: 'closest',
    autosize: true,
    annotations,
    barmode: 'stack',
    xaxis: {
      title: 'Positive & Negative Chart',
      fixedrange: true,
      showline: true,
      showgrid: true,
    },
    yaxis: {
      showticklabels: false,
      fixedrange: true,
      showgrid: true,
      autorange: 'reversed',
    },
  };
  
  return (
    <Plot
      data={data}
      layout={layout}
      style={responsiveStyle}
      onLegendClick={() => false}
    />
    );
}

export default PosNegChart;
  