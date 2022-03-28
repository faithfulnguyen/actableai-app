import { t } from '@superset-ui/translation';
import { round } from 'lodash';
import React from 'react';

interface IConfusionMatrixProps {
  chartData: any;
}

function ConfusionMatrix({ chartData }: IConfusionMatrixProps) {
    const { evaluate } = chartData.data;

    const labels = evaluate.labels as string[];
    const matrix = evaluate.confusion_matrix as number[][];
    const matrix_std_err = evaluate.matrix_std_err as number[][];
    
    let showMetric = !!labels && !!matrix;

    return (
      <div id="table-performance" style={{ maxWidth: '100%', overflow: 'auto' }}>
        {showMetric && (
          <table id="confusion-matrix">
            <thead>
              <tr key="tr0">
                <th key="th0" rowSpan={2} colSpan={2}></th>
                <th key="th1" colSpan={labels.length} className="background">
                  {t('Predicted class')}
                </th>
              </tr>
              <tr key="tr1">
                {labels.map((item,i) => (
                  <th key={`th${i+2}`} className="background">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowName, rowIndex) => (
                <tr key={`tr${rowIndex+2}`}>
                  {rowIndex === 0 && (
                    <td key={0} rowSpan={labels.length} className="background">
                      {t('Actual class')}
                    </td>
                  )}
                  <td key={"td" + rowIndex} className="background">{rowName}</td>
                  {matrix[rowIndex].map((item, columnIndex) => (
                    <td key={columnIndex.toString()}>
                      {round(item*100, 2)}%
                      {matrix_std_err && (
                        <span style={{ color: "red" }}>
                          &nbsp; &plusmn;{round(matrix_std_err[rowIndex][columnIndex]*100, 2)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  export default ConfusionMatrix;