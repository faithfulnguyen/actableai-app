import { t } from '@superset-ui/translation';
import React from 'react';

interface IMatrixTableProps {
  chartData: any;
}

function MetricTable({ chartData }: IMatrixTableProps) {
  const { evaluate } = chartData.data;

  return (
    <div id="metrics">
      <table>
        <tbody>
          <tr>
            <td><b>{t('Accuracy')}</b></td>
            <td>
              {evaluate.accuracy.toFixed(3)}
              {(evaluate.accuracy_std_err !== undefined) && (
                <span style={{ color: "red" }}>
                  &nbsp; &plusmn;{evaluate.accuracy_std_err.toFixed(3)}
                </span>
              )}
            </td>
          </tr>
          {((evaluate.auc_curve !== undefined) && (evaluate.auc_curve.positive_label !== undefined)) && (
            <tr>
              <td><b>{t('Positive label')}</b></td>
              <td>{evaluate.auc_curve.positive_label}</td>
            </tr>
          )}
          {((evaluate.auc_curve !== undefined) && (evaluate.auc_curve.threshold !== undefined)) && (
            <tr>
              <td><b>{t('Probability threshold')}</b></td>
              <td>{evaluate.auc_curve.threshold.toFixed(3)}</td>
            </tr>
          )}
          {(evaluate.auc_score !== undefined) && (
            <tr>
                <td><b>{t('AUC')}</b></td>
                <td>
                  {evaluate.auc_score.toFixed(3)}
                  {(evaluate.auc_score_std_err !== undefined) && (
                    <span style={{color: "red"}}>
                      &nbsp; &plusmn;{evaluate.auc_score_std_err.toFixed(3)}
                    </span>
                  )}
                </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MetricTable;
