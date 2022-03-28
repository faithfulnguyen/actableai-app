import { Data, Layout } from 'plotly.js';
import React from 'react';
import Plot from 'react-plotly.js';

interface IEffectPlotProps {
  chartData: ITaskDetails<any>;
  formData: any;
  width: number;
  height: number;
}

function EffectPlot({ chartData, formData, width, height }: IEffectPlotProps) {
  const { treatment, effect_modifier } = formData;
  if(chartData?.status !== 'SUCCESS') return null;
  
  const { effect } = chartData.data;
  const colorPalette = [
    [229, 129, 57], [200, 229, 57], [71, 229, 57], [57, 229, 172], [57, 157, 229],
    [86, 57, 229], [215, 57, 229], [229, 57, 114]
  ];

  let effectChartData: Data[] = [];
  let effectChartLayout: Partial<Layout> = {};

  const treatment_effect = new Map();
  effect.map((e: any) => {
    let group_name = e.treatment_value? e.treatment_value:treatment;
    if (!(treatment_effect.has(group_name))) {
      treatment_effect.set(group_name, []);
    }
    treatment_effect.get(group_name).push(e);
  });

  if ((effect_modifier != null) && (typeof(effect[0][effect_modifier]) == "number")) {
    let i = 0;
    treatment_effect.forEach((g, treatment_value, map) => {
      const fill = "rgba(" + colorPalette[i][0] + "," + colorPalette[i][1] + "," + colorPalette[i][2] + ",0.2)";
      const color = "rgba(" + colorPalette[i][0] + "," + colorPalette[i][1] + "," + colorPalette[i][2] + ")";
      const effect_modifiers = g.map((e: any) => e[effect_modifier]);
      const lb = g.map((e: any) => e.lb);
      const ub = g.map((e: any) => e.ub);
      const cate = g.map((e: any) => e.cate);
      effectChartData.push(...[
        {
          x: effect_modifiers.concat([...effect_modifiers].reverse(), effect_modifiers[0]),
          y: lb.concat([...ub].reverse(), lb[0]),
          fillcolor: fill,
          fill: "tozerox",
          line: {color: "transparent"},
          type: "scatter",
          hoverinfo: "skip",
          showlegend: false,
        },
        {
          x: effect_modifiers,
          y: ub,
          mode: "lines",
          type: "scatter",
          line: {
            color: fill,
          },
          showlegend: false,
          name: "upper"
        },
        {
          x: effect_modifiers,
          y: lb,
          mode: "lines",
          type: "scatter",
          name: "lower",
          line: {
            color: fill,
          },
          showlegend: false,
        },
        {
          x: effect_modifiers,
          y: cate,
          line: {color: color},
          mode: "lines",
          type: "scatter",
          name: treatment_value,
        }
      ] as Data[]);
      i++;
    });

    effectChartLayout = {
      width: width,
      height: height/2,
      xaxis: {
        title: effect_modifier,
        zeroline: false,
      },
      yaxis: {
        zeroline: false,
        title: "Treatment effect"
      },
    };
  }

  if ((effect_modifier == null) || (typeof(effect[0][effect_modifier]) == "string")) {
    effectChartData = [];
    treatment_effect.forEach((g, treatment_value, map) => {
      const effect_modifiers = g.map((e: any) => effect_modifier? e[effect_modifier]:"Treatment effect");
      const cate = g.map((e: any) => e.cate);
      effectChartData.push({
        x: effect_modifiers,
        y: cate,
        name: treatment_value,
        error_y: {
          type: "data",
          symmetric: false,
          array: g.map((e: any) => e.ub - e.cate),
          arrayminus: g.map((e: any) => e.cate - e.lb),
        },
        type: "bar",
      });
    });

    effectChartLayout = {
      height: height/2,
      showlegend: true,
    };
  }

  if(!effectChartData) return null;

  return (
    <Plot data={effectChartData} layout={effectChartLayout} />
  );
}

export default EffectPlot;
