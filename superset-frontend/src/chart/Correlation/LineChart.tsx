import React from 'react';
import { Data, Layout } from "plotly.js";
import Plot from "react-plotly.js";
import { responsiveStyle } from "./shared";

interface ILineChartProps {
  chartData: any;
  index: number;
}

function LineChart({ chartData, index }: ILineChartProps) {
  const line1 = chartData.data[0] || [];
  const line2 = chartData.data[1] || [];
  return (
    <Plot
      key={index}
      data={[
          {
              x: line1.x || [],
              y: line1.y || [],
              type: 'scatter',
              mode: 'lines+markers',
              marker: { color: '#83dfe2' },
              line: { shape: 'spline' },
              fill: 'tonexty',
              name: line1.value,
          },
          {
              x: line2.x || [],
              y: line2.y || [],
              type: 'scatter',
              mode: 'lines+markers',
              marker: { color: '#fba29d' },
              line: { shape: 'spline' },
              fill: 'tozeroy',
              name: line2.value,
          },
      ] as Data[]}
      layout={{
          autosize: true,
          xaxis: {
              title: line1['y_label'],
          },
          yaxis: {
              title: 'Density',
          },
          showlegend: true,
          legend: {
              orientation: 'h',
          },
      } as Partial<Layout>}
      style={responsiveStyle}
    />
  );
}

export default LineChart;
