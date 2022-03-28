import React, { useEffect } from 'react';
import Loading from 'src/components/Loading';

interface IDynamicChartProps {
  children?: React.ReactElement;
  reQuery: () => void;
  chartData?: any;
  handleResize?: () => void;
}

function DynamicChart({
  children, chartData, handleResize
}: IDynamicChartProps) {
  useEffect(() => {
    if(handleResize) {
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      }
    }
    return () => {};
  }, []);

  if (chartData) {
    if (chartData.status === 'loading' || chartData.status === 'PROCESSING') return <Loading size={50} />;
    if (chartData.status === 'SUCCESS' && chartData.data) return children || <div />;
  }
  return <div />;
}

export default DynamicChart;
