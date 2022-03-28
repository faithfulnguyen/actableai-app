import React, { useEffect, useRef, useState } from 'react'
import Plot, { PlotParams } from 'react-plotly.js'
import Plotly, { PlotData } from 'plotly.js'
import { t } from '@superset-ui/translation';

const getAxesFromLayout = (newLayout: Partial<Plotly.Layout>) => Object.keys(newLayout).filter(key => key.startsWith('yaxis'));

const willBeVisible = (axis: string, newLayout: Partial<Plotly.Layout>) => {
	if (newLayout[axis]) {
  	return typeof newLayout[axis].visible === 'undefined' || newLayout[axis].visible;
  } else {
  	return !newLayout[axis] || typeof newLayout[axis].visible === 'undefined' || newLayout[axis].visible;
  }
};


const layoutX = (newLayout: Partial<Plotly.Layout>, isCompact: boolean) => {
  const axes = getAxesFromLayout(newLayout);
	const plotIndex = axes.length;
  const axisWidth = isCompact ? 0.04 : 0.07; // calculation to have space for label or no label on each axis
  // Left axis
  let leftOffset = 0;
  for (let i = 0; i < plotIndex; i++) {
  	if (willBeVisible(axes[i], newLayout)) {
      if (typeof newLayout[axes[i]] === 'undefined') {
        newLayout[axes[i]] = {
          position: leftOffset
        };
      } else {
        newLayout[axes[i]].position = leftOffset;
      }
      leftOffset += axisWidth;
    }
  }
  
  // Right axis
  let rightOffset = 1;
  for (let i = axes.length - 1; i > plotIndex; i--) {
  	if (willBeVisible(axes[i], newLayout)) {
      rightOffset -= axisWidth;
      if (typeof newLayout[axes[i]] === 'undefined') {
        newLayout[axes[i]] = {
          position: rightOffset
        };
      } else {
        newLayout[axes[i]].position = rightOffset;
      }
    }
  }
  
  // Plot
  const domain = [ Math.max(0, leftOffset - axisWidth), rightOffset ];
  if (typeof newLayout.xaxis === 'undefined') {
    newLayout.xaxis = {
      domain
    };
  } else {
    newLayout.xaxis.domain = domain;
  }
  
  return newLayout;
};

const traceMappings = (data: Partial<PlotData>[]) => {
  const traceToAxis: Record<string, number> = {};
  const axisToTraces: Record<string, number[]> = {};
  // Create an object of what traces are on which axis
  data.forEach((trace, index) => {
    const axis = (trace.yaxis && trace.yaxis.length > 1) ? Number(trace.yaxis.slice(1)) : 1;

    traceToAxis[index] = axis;
    if (typeof axisToTraces[axis] === 'undefined') {
      axisToTraces[axis] = [index];
    } else {
      axisToTraces[axis].push(index);
    }
  });
  
  return {
  	traceToAxis,
    axisToTraces
  };
};

interface IMultiYAxisPlotProps extends PlotParams {
  data: Partial<PlotData>[];
  width: number;
}

function MultiYAxisPlot({ layout: initialLayout, data, width }: IMultiYAxisPlotProps) {
  const [layout, setLayout] = useState({ 
    ...initialLayout,
    width,
  } as Partial<Plotly.Layout>);
  
  const [isCompact, setIsCompact] = useState(true);
  const id = useRef(`multiYAxisPlot${document.getElementsByClassName('multiYAxisPlot').length}`);

  useEffect(() => {
    const nextLayout = { ...layout };

    const axes = getAxesFromLayout(nextLayout);

    axes.forEach((axis) => {
      nextLayout[axis].title = {
        ...nextLayout[axis].title,
        text: isCompact ? '' : initialLayout[axis].title.text,
      };
    })
    
    setLayout(nextLayout);
  }, [isCompact])  

  useEffect(() => {
    const newLayout: Partial<Plotly.Layout> = { ...layout, width };
    setLayout(newLayout);
  }, [width])

  return (
    <>
      <button className="btn float-right" onClick={() => setIsCompact(!isCompact)}>
        {isCompact
          ? t('Show Y-Axes Titles')
          : t('Hide Y-Axes Titles')}
      </button>
      <Plot
        className='multiYAxisPlot'
        divId={id.current}
        layout={layout}
        data={data}
        onRestyle={([updatedData, tracesTouched]) => {
          if (updatedData.visible) {
            const newLayout: Partial<Plotly.Layout> = { ...layout };
            const visibleUpdates = updatedData.visible;
            const { traceToAxis, axisToTraces } = traceMappings(data);

            tracesTouched.forEach((trace, index) => {
              const axis = traceToAxis[trace];
              const axisLabel = axis === 1 ? 'yaxis' : 'yaxis' + axis;
              
              if (visibleUpdates[index] === true) {
                // Check if axis is already visible
                if (newLayout[axisLabel] && newLayout[axisLabel].visible === false) {
                  newLayout[axisLabel].visible = true;
                }
              } else {
                if (axisToTraces[axis].length > 1) {
                  // Check if the other traces on the axis are already hidden
                  const visibleTrace = axisToTraces[axis].find((twinTrace) => typeof data[twinTrace].visible === 'undefined' || data[twinTrace].visible === true);
                  if (typeof visibleTrace === 'undefined') {
                    newLayout[axisLabel].visible = false;
                  }
                } else {
                  if (typeof newLayout[axisLabel].visible === 'undefined' || newLayout[axisLabel].visible === true) {
                    newLayout[axisLabel].visible = false;
                  }
                }
              }
            });
            layoutX(newLayout, isCompact);
            setLayout(newLayout)
          }
        }}
      />
    </>
  )
}

export default MultiYAxisPlot
