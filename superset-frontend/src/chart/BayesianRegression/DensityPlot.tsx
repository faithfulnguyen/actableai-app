import { Data, Layout } from "plotly.js";
import React from "react";
import Plot from "react-plotly.js";

interface IDensityPlotProps {
  analysis: FullAnalysis;
  title: string;
  style?: React.CSSProperties;
  isUnivariate?: boolean;
  univariateIndex?: number;
}

export function DensityPlot({
   analysis, style, title, isUnivariate, univariateIndex
}: IDensityPlotProps) {
  if(isUnivariate && univariateIndex === undefined){
    throw Error('Univariate DensityPlot must have a univariateIndex');
  }

  const layout: Partial<Layout> = {
    autosize: true,
    xaxis: {
      title,
    },
    yaxis: {
        title: 'Density',
    },
    showlegend: true,
    legend: {
        orientation: 'h',
    },
  };

  const x = isUnivariate
  ? analysis.analysis.pdfs[univariateIndex!][0]
  : analysis.pdfs[0];

  const y = isUnivariate
  ? analysis.analysis.pdfs[univariateIndex!][1]
  : analysis.pdfs[1];

  const data: Data[] = [
    {
      x,
      y,
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: '#83dfe2' },
      line: { shape: 'spline' },
      fill: 'tonexty',
      name: '',
      showlegend: false,
    },
  ];

  return (
    <Plot
      data={data}
      layout={layout}
      style={style}
    />
  );
}
