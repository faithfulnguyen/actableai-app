import React from 'react';
import Plot from 'react-plotly.js';
import { Data } from 'plotly.js';

const CHART_TYPE = {
  KERNEL_DENSITY_ESTIMATION: 'kde',
  SCATTER: 'scatter',
  BAR: 'bar'
};
const colors = [
  '#1f77b4',  // muted blue
  '#ff7f0e',  // safety orange
  '#2ca02c',  // cooked asparagus green
  '#d62728',  // brick red
  '#9467bd',  // muted purple
  '#8c564b',  // chestnut brown
  '#e377c2',  // raspberry yogurt pink
  '#7f7f7f',  // middle gray
  '#bcbd22',  // curry yellow
];

interface IDebiasingChartProps {
  groupData: TDebiasingChart;
  width: number;
}

function DebiasingChart({ groupData, width }: IDebiasingChartProps) {
  const titles = ['Original', 'Prediction'];

  let data: Data[] = [];
  let layout: any = {};

  layout.autosize = true;
  layout.grid = {
    rows: 1,
    columns: groupData.charts.length,
    pattern: 'independent'
  };
  layout.margin = {
    t: 20
  };

  switch (groupData.type) {
    case CHART_TYPE.KERNEL_DENSITY_ESTIMATION:
      layout.legend = {
        title: { text: groupData.group }
      }

      for (let chartIndex = 0; chartIndex < groupData.charts.length; chartIndex++) {
        const chartData = groupData.charts[chartIndex];
        const axisIndex = (chartIndex + 1).toString();

        layout['xaxis' + axisIndex] = { title: chartData.x_label };
        layout['yaxis' + axisIndex] = { title: 'Density' };

        if (chartData.lines) {
          for (let lineIndex = 0; lineIndex < chartData.lines.length; lineIndex++) {
            const lineData = chartData.lines[lineIndex];

            data.push({
              x: chartData.x || [],
              y: lineData.y || [],
              name: lineData.name,
              legendgroup: lineData.name,
              showlegend: chartIndex == 0,
              type: 'scatter',
              mode: 'lines',
              line: { shape: 'spline' },
              marker: { color: colors[lineIndex % colors.length] },
              xaxis: 'x' + axisIndex,
              yaxis: 'y' + axisIndex
            });
          }
        }
      }
      break;

    case CHART_TYPE.SCATTER:
      layout.showlegend = false;

      for (let chartIndex = 0; chartIndex < groupData.charts.length; chartIndex++) {
        const chartData = groupData.charts[chartIndex];
        const axisIndex = (chartIndex + 1).toString();

        layout['xaxis' + axisIndex] = { title: chartData.x_label };
        layout['yaxis' + axisIndex] = { title: groupData.group };

        data.push({
          x: chartData.x || [],
          y: chartData.y || [],
          name: 'Data points',
          type: 'scatter',
          mode: 'markers',
          marker: { color: colors[0] },
          xaxis: 'x' + axisIndex,
          yaxis: 'y' + axisIndex
        });
      }
      break;

    case CHART_TYPE.BAR:
      layout.barmode = 'stack';
      layout.legend = { title: { text: groupData.target } }

      for (let chartIndex = 0; chartIndex < groupData.charts.length; chartIndex++) {
        const chartData = groupData.charts[chartIndex];
        const axisIndex = (chartIndex + 1).toString();

        layout['xaxis' + axisIndex] = {
          title: chartData.x_label + ' proportions',
          fixedrange: true
        };
        layout['yaxis' + axisIndex] = {
          title: groupData.group,
          fixedrange: true,
          type: 'category'
        };

        if(chartData.bars){
          for (let barIndex = 0; barIndex < chartData.bars.length; barIndex++) {
            const barData = chartData.bars[barIndex];

            data.push({
              x: barData.x || [],
              y: chartData.y || [],
              name: barData.name,
              legendgroup: barData.name,
              showlegend: chartIndex == 0,
              type: 'bar',
              marker: { color: colors[barIndex % colors.length] },
              orientation: 'h',
              xaxis: 'x' + axisIndex,
              yaxis: 'y' + axisIndex
            });
          }
        }
      }
      break;
  }

  return (
    <div>
      <h3>Biased Group - {groupData.group}</h3>
      <div style={{ width }}>
        {groupData.charts.map((chartData: any, index: number) => (
          <div
            style={{
              textAlign: 'center',
              display: 'inline-block',
              width: (100 / groupData.charts.length).toString() + '%'
            }}
            key={index.toString()}>
            <h4>
              <strong>{`${titles[index]} - ${groupData.group} VS ${chartData.x_label}`}</strong>
            </h4>
            {`Spearman correlation: ${parseFloat(chartData.corr).toFixed(3)}`}
            {` | pvalue: ${parseFloat(chartData.pvalue).toFixed(3)}`}
          </div>
        ))}
      </div>
      <Plot
        data={data}
        layout={layout}
        style={{
          "width": width
        }}
      />
    </div>
  );
}

export default DebiasingChart;
