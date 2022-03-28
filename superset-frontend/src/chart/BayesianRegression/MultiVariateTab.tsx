import React from 'react';
import { DensityPlot } from './DensityPlot';
import { responsiveStyle } from './shared';

interface IMultiVariateTabProps {
  analyses: FullAnalysis[];
}

function MultiVariateTab({ analyses }: IMultiVariateTabProps) {

  return (
    <>
      {analyses.map(analysis => (
        <DensityPlot analysis={analysis} style={responsiveStyle} title={analysis.name} />
      ))}
    </>
  );
}

export default MultiVariateTab;
