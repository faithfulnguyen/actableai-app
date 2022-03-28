import React from 'react';
import Plot from 'react-plotly.js';
import { subtract, square, sqrt, divide, add, mean, std, MathArray } from 'mathjs';
import { Data } from 'plotly.js';


interface IPerformanceChartProps {
  chartData: ITaskDetails<IClassificationAnalysisData<TClassificationEvaluationDetails>>;
  setChartData: (newState: any) => void;
  width: number;
  height: number;
  predicted_column: string;
}

function PerformanceChart({ chartData, setChartData, width, height, predicted_column }: IPerformanceChartProps) {
  const evaluate = chartData.data.evaluate as IBinaryClassificationEvaluateDetails;

  const handleClick = (e: any) => {
    const cross_validation_exdata = chartData.data.cross_validation_exdata;
    const threshold = evaluate.auc_curve.thresholds[e.points[0].pointIndex];
    let matrix: MathArray = [[0, 0], [0, 0]];
    let confusion_matrix_std_err;
    let accuracy = 0;
    let accuracy_std_err;
    if (evaluate.auc_curve.thresholds === undefined) {
      return;
    }
    if (cross_validation_exdata === undefined){
      let matrix = [[0, 0], [0, 0]];
      for (let i = 0; i < chartData.data.exdata.length; i++) {
          const label = chartData.data.exdata[i][predicted_column];
          let prob = chartData.data.exdata[i]["__probability__"];
          if (label != evaluate.auc_curve.positive_label) {
              prob = 1 - prob;
          }
          let pred_label = (prob >= threshold) ? evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
          let true_label = chartData.data.exdata[i][predicted_column];
          let row_id = (true_label==evaluate.auc_curve.positive_label)? 1:0;
          let col_id = (pred_label==evaluate.auc_curve.positive_label)? 1:0;
          matrix[row_id][col_id] += 1;
      }
      accuracy = (matrix[1][1] + matrix[0][0])/(matrix[0][0] + matrix[0][1] + matrix[1][0] + matrix[1][1]);
    } else {
      let kf_confusion_matrices = [];
      let kf_accuracies = [];
      let kf_fprs = [];
      let kf_tprs = [];
      const n_folds = cross_validation_exdata.length;
      if (n_folds == 0){
        return;
      }

      for (let i = 0; i < cross_validation_exdata.length; i++) {
        let kf_split_exdata = cross_validation_exdata[i];
        let matrix = [[0, 0], [0, 0]];
        for (let j = 0; j < kf_split_exdata.length; j++) {
          const label = kf_split_exdata[j][predicted_column];
          let prob = kf_split_exdata[j]["__probability__"];
          if (label != evaluate.auc_curve.positive_label) {
              prob = 1 - prob;
          }
          let pred_label = (prob >= threshold) ? evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
          let true_label = kf_split_exdata[j][predicted_column];
          let row_id = (true_label==evaluate.auc_curve.positive_label)? 1:0;
          let col_id = (pred_label==evaluate.auc_curve.positive_label)? 1:0;
          matrix[row_id][col_id] += 1;
        }
        const split_accuracy = (matrix[1][1] + matrix[0][0])/(matrix[0][0] + matrix[0][1] + matrix[1][0] + matrix[1][1]);
        matrix = matrix.map((row, k) => {
          let sum = row.reduce((a, b) => a + b);
          return row.map(x => x/sum);
        });
        kf_confusion_matrices.push(matrix);
        kf_tprs.push(matrix[0][0]);
        kf_fprs.push(matrix[0][1]);
        kf_accuracies.push(split_accuracy);
      }
      // calculate standard error

      let kf_confusion_matrices_mean = divide(kf_confusion_matrices.reduce((a, b) => add(a,b), [[0,0],[0,0]]), kf_confusion_matrices.length) as MathArray;

      confusion_matrix_std_err = sqrt(divide(
        kf_confusion_matrices.reduce((a, b) => 
          add(
            square(subtract(kf_confusion_matrices_mean, a) as MathArray),
            square(subtract(kf_confusion_matrices_mean, b) as MathArray)
          )
        , []),
        n_folds
      ) as any);

      matrix = kf_confusion_matrices_mean;
      accuracy = mean(kf_accuracies);
      accuracy_std_err = std(kf_accuracies) / sqrt(n_folds);
    }

    // Update predictions
    const predictions = [];
    if (chartData.data.predictData) {
      for (let i = 0; i < chartData.data.predictData.length; i++) {
        const prediction = chartData.data.predictData[i];
        const prob = prediction["__probability__"];
        const label = prediction[predicted_column];
        const pos_prob =  (label == evaluate.auc_curve.positive_label) ? prob : 1 - prob;
        prediction[predicted_column] =
            (pos_prob >= threshold)?
                evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
        prediction["__probability__"] = (pos_prob >= threshold)? pos_prob : 1 - pos_prob;
        predictions.push(prediction);
      }
    }

    setChartData({
      ...chartData,
      data: {
        ...chartData.data,
        evaluate: {
          ...chartData.data.evaluate,
          confusion_matrix: matrix,
          confusion_matrix_std_err: confusion_matrix_std_err,
          accuracy: accuracy,
          accuracy_std_err: accuracy_std_err,
          auc_curve: {
            ...evaluate.auc_curve,
            threshold: threshold
          }
        },
        predictData: predictions
      }
    });
  }

  let auc_curve = evaluate.auc_curve;

  // calculate std err for all threshold
  if (chartData.data.cross_validation_exdata !== undefined &&
    chartData.data.cross_validation_exdata.length >0 &&
    auc_curve !== undefined){
    let evaluate = chartData.data.evaluate;
    const cross_validation_exdata = chartData.data.cross_validation_exdata;
    const n_folds = cross_validation_exdata.length;
    let tpr_std_errs = [];
    let fpr_std_errs = [];

    for (let i = 0; i < auc_curve.thresholds.length; i++) {
      let threshold = auc_curve.thresholds[i];
      let kf_tprs = [];
      let kf_fprs = [];
      for (let j = 0; j < cross_validation_exdata.length; j++) {
        let kf_split_exdata = cross_validation_exdata[j];
        let matrix = [[0, 0], [0, 0]];
        for (let k = 0; k < kf_split_exdata.length; k++) {
          const label = kf_split_exdata[k][predicted_column];
          let prob = kf_split_exdata[k]["__probability__"];
          if (label != auc_curve.positive_label) {
              prob = 1 - prob;
          }
          let pred_label = (prob >= threshold) ? auc_curve.positive_label:auc_curve.negative_label;
          let true_label = kf_split_exdata[k][predicted_column];
          let row_id = (true_label==auc_curve.positive_label)? 1:0;
          let col_id = (pred_label==auc_curve.positive_label)? 1:0;
          matrix[row_id][col_id] += 1;
        }
        matrix = matrix.map((row, k) => {
          let sum = row.reduce((a, b) => a + b);
          return row.map(x => x/sum);
        });
        kf_tprs.push(matrix[0][0]);
        kf_fprs.push(matrix[0][1]);
      }

      let tpr_std_err = std(kf_tprs) / sqrt(n_folds);
      let fpr_std_err = std(kf_fprs) / sqrt(n_folds);
      tpr_std_errs.push(tpr_std_err);
      fpr_std_errs.push(fpr_std_err);
    }
    auc_curve = evaluate['auc_curve'];
    auc_curve['TPR_stderr'] = tpr_std_errs;
    auc_curve['FPR_stderr'] = fpr_std_errs;
  }

  if (auc_curve!== undefined){
    let chart: Data[] = [{
      mode: 'lines+markers',
      type: "scatter",
      x: auc_curve["False Positive Rate"],
      y: auc_curve["True Positive Rate"],
      marker: {
        size: 6,
        color: "gray"
      },
      name: "roc",
    }];
    if (auc_curve["FPR_stderr"] !== undefined &&
      auc_curve["FPR_stderr"] !== undefined){
        chart[0]['error_y'] = {
          type: 'data',
          array: auc_curve["TPR_stderr"],
          visible: true,
          color: 'red'
        };
        chart[0]['error_x'] = {
          type: 'data',
          array: auc_curve["FPR_stderr"],
          visible: true,
          color: 'red'
        };
      };
    const px = width > height ? height : width;
    const layoutChart = {
      width: px,
      height: px,
      showlegend: false,
      xaxis: {
        title: "False Positive Rate",
        range: [0, 1],
      },
      yaxis: {
        title: "True Positive Rate",
        range: [0, 1],
      },
    };

    return (
      <div style={{ overflow: 'auto' }}>
        <Plot data={chart} layout={layoutChart} onClick={handleClick} />
      </div>
    );
  }
  return null;
}

export default PerformanceChart;
