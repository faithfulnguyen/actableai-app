import React from 'react';

interface IPerformanceTableProps {
  evaluate: any;
  importantFeatures: any[];
}

function PerformanceTable({ evaluate, importantFeatures }: IPerformanceTableProps) {
  let showMetric = evaluate.RMSE !== undefined && evaluate.R2 !== undefined;
  let showFeatures = importantFeatures !== undefined && importantFeatures.length > 0;
  let show_std_err = evaluate.RMSE_std_err !== undefined && evaluate.R2_std_err !== undefined;

  return (
    <div id="table-performance">
      {showMetric && (
        <div>
          <strong style={{ width: '60px', display: 'inline-block' }}>
            Metrics:{' '}
          </strong>
          <label>
            <strong>RMSE</strong>: {evaluate.RMSE.toFixed(3)}
            {show_std_err && (
              <span style={{color: "red"}}>
                &nbsp; &plusmn;{evaluate.RMSE_std_err.toFixed(3)}
              </span>
            )}
          </label>
          <br />
          <strong style={{ width: '60px', display: 'inline-block' }}></strong>
          <label>
            <strong>R2</strong>: {evaluate.R2.toFixed(3)}
            {show_std_err && (
              <span style={{color: "red"}}>
                &nbsp; &plusmn;{evaluate.R2_std_err.toFixed(3)}
              </span>
            )}
          </label>
        </div>
      )}
      {showFeatures && (
        <table id="table2">
          <thead>
            <tr>
              <th className="background">Feature</th>
              <th className="background">Importance</th>
            </tr>
          </thead>
          <tbody>
            {importantFeatures.map((row, k) => (
              <tr key={k}>
                <td>{row.feature}</td>
                <td>
                  {row.importance.toFixed(3)}
                  {show_std_err && (
                    <span style={{color: "red"}}>
                      &nbsp; &plusmn;{row.importance_std_err.toFixed(3)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PerformanceTable;
