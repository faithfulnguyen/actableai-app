import React from 'react';

interface IImportantFeaturesProps {
  chartData: any;
}

function ImportantFeatures({ chartData }: IImportantFeaturesProps) {
  let importantFeatures: any[] = chartData?.data?.importantFeatures || [];
  let showFeatures = importantFeatures.length > 0;

  return (
    <div id="table-performance">
      {showFeatures && (
        <table id="important-features">
          <thead>
            <tr>
              <th className="background">Important Features</th>
            </tr>
            <tr>
              <th className="background">Importance</th>
            </tr>
          </thead>
          <tbody>
            {importantFeatures.map((row, rowIndex) =>
              <tr key={rowIndex.toString()}>
                <td>{row.feature}</td>
                <td>
                  {row.importance.toFixed(3)}
                  {(row.importance_std_err !== undefined) && (
                    <span style={{ color: "red" }}>
                      &nbsp; &plusmn;{row.importance_std_err.toFixed(3)}
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ImportantFeatures;
