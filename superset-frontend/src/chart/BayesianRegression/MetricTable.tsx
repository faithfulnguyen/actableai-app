import React from 'react';

interface IPerformanceTableProps {
  evaluation: {
    rmse: number;
    r2: number;
  };
}

function PerformanceTable({ evaluation }: IPerformanceTableProps) {
  if (evaluation.rmse === undefined || evaluation.r2 === undefined) {
    return <></>;
  }
  return (
    <div id="table-performance">
      <div>
        <strong style={{ width: '60px', display: 'inline-block' }}>
          Metrics:{' '}
        </strong>
        <label>
          <strong>RMSE</strong>: {evaluation.rmse.toFixed(3)}
        </label>
        <br />
        <strong style={{ width: '60px', display: 'inline-block' }}></strong>
        <label>
          <strong>R2</strong>: {evaluation.r2.toFixed(3)}
        </label>
      </div>
    </div>
  );
}

export default PerformanceTable;