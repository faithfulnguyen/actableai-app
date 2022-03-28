import React from 'react'
import { d3 } from 'plotly.js';
import GraphViz, { IGraphVizProps } from './GraphViz'

interface ICausalGraphProps extends Omit<IGraphVizProps, 'styleCallback'> {
  formData: any;
}

function CausalGraph({
  id, height, scale, width, renderDot, formData,
}: ICausalGraphProps) {
  window.d3 = d3;
  const styleCasualgraph = () => {
    d3.selectAll(`#GraphViz-${id} g#graph0 g`).each(function(this: any, p, j) {
      const ellipse = d3.select(this).select("ellipse");
      if (formData.common_causes?.includes(p.key)) {
        ellipse.attr("fill", "#f0efeb");
      } else if (p.key == formData.effect_modifier) {
        ellipse.attr("fill", "#99c1de");
      } else if (p.key == formData.treatment) {
        ellipse.attr("fill", "#eddcd2");
      } else if (p.key == formData.outcome) {
        ellipse.attr("fill", "#fad2e1");
      }
    });
  }

  return (
    <GraphViz
      id={id}
      height={height}
      scale={scale}
      width={width}
      renderDot={renderDot}
      styleCallback={styleCasualgraph}
    />
  )
}

export default CausalGraph
