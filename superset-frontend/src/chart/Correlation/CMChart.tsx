import React from 'react';
import _ from "lodash";
import { Annotations, Data, Layout } from "plotly.js";
import Plot from "react-plotly.js";
import { responsiveStyle, round } from "./shared";

interface ICmChartProps {
  chartData: any;
  corrData: any;
  index: any;
}

function CmChart({ chartData, corrData, index }: ICmChartProps) {
  const cmData = chartData.data?.cm || {};
  let yKeys = Object.keys(cmData);
  const xKeys = _.reduce(
      yKeys,
      (result, item) => {
          return _.union(result, Object.keys(cmData[item] || {}));
      },
      [],
  );
  const zValues = [];
  for (let yIdx = 0; yIdx < yKeys.length; yIdx++) {
      const yKey = yKeys[yIdx];
      let tmp = [];
      for (let xIdx = 0; xIdx < xKeys.length; xIdx++) {
          const xKey = xKeys[xIdx];
          tmp.push(round(cmData[yKey][xKey], 4) * 100);
      }
      zValues.push(tmp);
      tmp = [];
  }

  var colorscaleValue: Array<[number, string]> = [
      [0, '#F8FBFF'],
      [1, '#133167'],
  ];

  if (Array.isArray(corrData.col)) {
      yKeys = yKeys.map(item => `${corrData.col[0]}: ${item}`);
  }

  const data: Data[] = [
      {
          z: zValues,
          x: xKeys,
          y: yKeys,
          type: 'heatmap',
          hoveron: 'points',
          colorscale: colorscaleValue,
          colorbar: { x: 1.2, len: 1.06 },
      },
  ];
  var layout: Partial<Layout> = {
      annotations: [],
      xaxis: {
          ticks: '',
          side: 'top',
          color: '#3269a8',
      },
      yaxis: {
          ticks: '',
          ticksuffix: ' ',
          automargin: true,
      },
      autosize: true,
      margin: {
          t: 100,
          r: 0,
          l: 0,
          b: 20,
      },
  };

  for (var i = 0; i < yKeys.length; i++) {
      for (var j = 0; j < xKeys.length; j++) {
          var currentValue = zValues[i][j];
          if (currentValue > 60) {
              var textColor = 'white';
          } else {
              var textColor = 'black';
          }
          var result: Partial<Annotations> = {
              xref: 'x',
              yref: 'y',
              x: xKeys[j],
              y: yKeys[i],
              text: `${currentValue.toPrecision(4)}%`,
              font: {
                  family: 'Arial',
                  size: 12,
                  color: textColor,
              },
              showarrow: false,
          };
          layout.annotations!.push(result);
      }
  }

  return (
    <Plot
      key={index}
      data={data}
      layout={layout}
      style={responsiveStyle}
    />
  );
}

export default CmChart;
