import React, { useEffect, useRef } from 'react'
import { graphviz } from 'd3-graphviz';

export interface IGraphVizProps {
  id: string;
  width: number;
  height: number;
  scale: number;
  renderDot: string;
  styleCallback?: (ref: HTMLDivElement) => void;
}

function GraphViz({
  id, width, height, scale, renderDot, 
  styleCallback,
}: IGraphVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !renderDot) return;

    graphviz(containerRef.current, { useWorker: false })
    .width(width)
    .height(height)
    .fit(true)
    .scale(scale)
    .renderDot(renderDot);

    styleCallback?.(containerRef.current);

  }, [width, height, scale, renderDot, containerRef.current])
  
  return (
    <div id={`GraphViz-${id}`} ref={containerRef} />
  )
}

export default GraphViz
