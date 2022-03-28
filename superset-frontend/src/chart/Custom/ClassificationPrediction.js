import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import { MultiGrid } from "react-virtualized";
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import axios from 'axios';
import TooltipWrapper from 'src/components/TooltipWrapper';
import { subtract, square, sqrt, divide, add, mean, std} from 'mathjs';
import styled from 'styled-components';

let headerTable = [];
let dataTable = {};

const StyledTabs = styled(Tabs)`
  & .tab-content {
    overflow: auto;
  }
`;

class ConfusionMatrix extends Component {

  render(){
    // get data Actual && Predicted
    const labels = this.props.labels;
    const matrix = this.props.matrix;
    const matrix_std_err = this.props.matrix_std_err;
    let showMetric = true;
    if (labels===undefined || matrix===undefined) { showMetric = false; }
    return(
      <div id="table-performance" style={{ maxWidth: '100%', overflow: 'auto' }}>
        {showMetric &&
          <table id="confusion-matrix">
            <thead>
              <tr key="tr0">
                <th key="th0" rowSpan="2" colSpan="2"></th>
                <th key="th1" colSpan={labels.length} className="background">Predicted class</th>
              </tr>
              <tr key="tr1">
              {
              labels.map((item,i) =>
                <th key={`th${i+2}`} className="background">{item}</th>
              )
              }
              </tr>
            </thead>
            <tbody>
            {
            labels.map((item,i) =>
              <tr key={`tr${i+2}`}>
                {i===0 && <td key={0} rowSpan={labels.length} className="background">Actual class</td>}
                <td key={"td" + i} className="background">{item}</td>
                {
                  matrix[i].map((x, j) =>
                    <td>
                      {
                      _.round(x*100, 2)
                      }%
                      { matrix_std_err &&
                        (<span style={{color: "red"}}>
                          &nbsp; &plusmn;{_.round(matrix_std_err[i][j]*100, 2)}
                        </span>)
                      }
                    </td>
                  )
                }
              </tr>
            )
            }
            </tbody>
          </table>
        }
      </div>
    );
  }

}


class MetricTable extends Component {

  render() {
    const evaluate = this.props.evaluate;
    return (<div id="metrics">
        <table>
            <tbody>
                <tr>
                    <td><b>Accuracy</b></td>
                    <td>
                      {evaluate.accuracy.toFixed(3)}
                      {(evaluate.accuracy_std_err !== undefined) && (
                        (<span style={{color: "red"}}>
                          &nbsp; &plusmn;{evaluate.accuracy_std_err.toFixed(3)}
                        </span>)
                      )}
                    </td>
                </tr>
                {((evaluate.auc_curve !== undefined) && (evaluate.auc_curve.positive_label !== undefined)) &&
                <tr>
                    <td><b>Positive label</b></td>
                    <td>{evaluate.auc_curve.positive_label}</td>
                </tr>}
                {((evaluate.auc_curve !== undefined) && (evaluate.auc_curve.threshold !== undefined)) &&
                <tr>
                    <td><b>Probability threshold</b></td>
                    <td>
                      {evaluate.auc_curve.threshold.toFixed(3)}
                    </td>
                </tr>}
                {(evaluate.auc_score !== undefined) &&
                <tr>
                    <td><b>AUC</b></td>
                    <td>
                      {evaluate.auc_score.toFixed(3)}
                      {(evaluate.auc_score_std_err !== undefined) && (
                        (<span style={{color: "red"}}>
                          &nbsp; &plusmn;{evaluate.auc_score_std_err.toFixed(3)}
                        </span>)
                      )}
                    </td>
                </tr>}
            </tbody>
        </table>
    </div>);
  }
}

class PredictionTable extends Component {

   constructor(props) {
     super(props);
     this.cellRender = this.cellRender.bind(this);
   }

   cellRender({columnIndex, key, parent, rowIndex, style}) {
     const className = rowIndex%2===0?"cell even":"cell odd";
        if(rowIndex === 0){
          return (
            <div className="header" key={key} style={style}>
              <TooltipWrapper label="cell" tooltip={this.props.records.columns[columnIndex]}>
                <span>{this.props.records.columns[columnIndex]}</span>
              </TooltipWrapper>
            </div>
          );
        }else{
          let stylePredict = {};
          if(this.props.data_columns.indexOf(this.props.records.columns[columnIndex]) < 0) {
            stylePredict = {
              color: 'red',
              fontWeight: 'bold'
            }
          }
          const text = this.props.records.data[this.props.records.columns[columnIndex]][rowIndex - 1];
          return (
            <div className={className} key={key} style={style}>
              <TooltipWrapper
                label="cell"
                tooltip={text}
              >
                <span style={stylePredict}>{text}</span>
              </TooltipWrapper>
            </div>
          );
        }
    }

    render() {
      return(<div id="virtualized-table" style={{ float: "left", marginTop :"50px"}}>
        <MultiGrid
          columnCount={this.props.records.columns.length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={this.props.height-23}
          cellRenderer={this.cellRender}
          rowCount={this.props.records.data[this.props.records.columns[0]].length+1}
          rowHeight={48}
          width={this.props.width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </div>);
    }
}


class LegacyPredictionTable extends Component {

   constructor(props) {
     super(props);
     this.cellRender = this.cellRender.bind(this);
   }

   cellRender({columnIndex, key, parent, rowIndex, style}) {
     const className = rowIndex%2===0?"cell even":"cell odd";
        if(rowIndex === 0){
          const value = this.props.columns[columnIndex]=="__probability__" ? 'probability' : this.props.columns[columnIndex];
          return (
            <div className="header" key={key} style={style}>
              <TooltipWrapper label="cell" tooltip={value}>
                <span>{value}</span>
              </TooltipWrapper>
            </div>
          );
        }else{
          let stylePredict = {};
          if(this.props.predicted_column===this.props.columns[columnIndex] ){
            stylePredict = {
              color: 'red',
              fontWeight: 'bold'
            }
          }
          const text = this.props.records[rowIndex-1][this.props.columns[columnIndex]];
          return (
            <div className={className} key={key} style={style}>
              <TooltipWrapper
                label="cell"
                tooltip={text}
              >
                <span style={stylePredict}>{text}</span>
              </TooltipWrapper>
            </div>
          );
        }
    }

    render() {
      return(<div id="virtualized-table" style={{ float: "left", marginTop :"50px"}}>
        <MultiGrid
          columnCount={this.props.columns.length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={this.props.height-23}
          cellRenderer={this.cellRender}
          rowCount={this.props.records.length+1}
          rowHeight={48}
          width={this.props.width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </div>);
    }
}


class ClassificationPrediction extends Component {

  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);

    this.state = {
      statusTrain: 'PROCESSING',
      messenger: '',
      taskId: null,
      fields: [],
      exdata: [],
      predictData: [],
      evaluate: {},
      importantFeatures: [],
      table: {},
      isPolling: true,
      //
      polling: null,
      reQuery: true,
      isLoading: true,
      validations: [],
      error_message: '',
    }
  }

  componentDidMount(){
    window.addEventListener("beforeunload", this.deleteTask.bind(this));
  }

  componentWillUnmount(){
    window.addEventListener("beforeunload", this.deleteTask.bind(this));
  }

  deleteTask(e){
    if(this.state.statusTrain !== "SUCCESS"){
      axios.delete(`/api/task/${this.state.taskId}`);
    }
  }

  UNSAFE_componentWillMount() {
      const { taskId } = this.props.queryResponse.data;
      this.setData(taskId);
  }

  UNSAFE_componentWillUpdate(nextProps, nextState, nextContext) {
      if(nextProps.queryResponse.data.taskId !== this.props.queryResponse.data.taskId) {
        const { taskId } = nextProps.queryResponse.data;
        this.setData(taskId);
      }
      const nextIsPolling = nextProps.chart === undefined ? nextProps.isPolling : nextProps.chart.isPolling;
      const isPolling = this.props.chart === undefined ? this.props.isPolling : this.props.chart.isPolling;
      if(nextIsPolling !== isPolling) {
        if(!nextIsPolling) {
            clearInterval(this.state.polling);
        }
      }
  }

  handleClick(e) {
      const evaluate = this.state.evaluate;
      const cross_validation_exdata = this.state.cross_validation_exdata;
      const threshold = evaluate.auc_curve.thresholds[e.points[0].pointIndex];
      let matrix = [[0, 0], [0, 0]];
      let confusion_matrix_std_err;
      let accuracy = 0;
      let accuracy_std_err;
      let tps_std_err = [];
      let fprs_std_err = [];
      if (evaluate.auc_curve.thresholds === undefined) {
        return;
      }
      if (cross_validation_exdata === undefined){
        let matrix = [[0, 0], [0, 0]];
        for (var i = 0; i < this.state.exdata.length; i++) {
            const label = this.state.exdata[i][this.state.predicted_column];
            var prob = this.state.exdata[i]["__probability__"];
            if (label != evaluate.auc_curve.positive_label) {
                prob = 1 - prob;
            }
            var pred_label = (prob >= threshold) ? evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
            var true_label = this.state.exdata[i][this.state.predicted_column];
            var row_id = (true_label==evaluate.auc_curve.positive_label)? 1:0;
            var col_id = (pred_label==evaluate.auc_curve.positive_label)? 1:0;
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

        for (var i = 0; i < cross_validation_exdata.length; i++) {
          let kf_split_exdata = cross_validation_exdata[i];
          let matrix = [[0, 0], [0, 0]];
          for (var j = 0; j < kf_split_exdata.length; j++) {
            const label = kf_split_exdata[j][this.state.predicted_column];
            var prob = kf_split_exdata[j]["__probability__"];
            if (label != evaluate.auc_curve.positive_label) {
                prob = 1 - prob;
            }
            var pred_label = (prob >= threshold) ? evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
            var true_label = kf_split_exdata[j][this.state.predicted_column];
            var row_id = (true_label==evaluate.auc_curve.positive_label)? 1:0;
            var col_id = (pred_label==evaluate.auc_curve.positive_label)? 1:0;
            matrix[row_id][col_id] += 1;
          }
          const split_accuracy = (matrix[1][1] + matrix[0][0])/(matrix[0][0] + matrix[0][1] + matrix[1][0] + matrix[1][1]);
          matrix = matrix.map((row, k) => {
            var sum = row.reduce((a, b) => a + b);
            return row.map(x => x/sum);
          });
          kf_confusion_matrices.push(matrix);
          kf_tprs.push(matrix[0][0]);
          kf_fprs.push(matrix[0][1]);
          kf_accuracies.push(split_accuracy);
        }
        // calculate standard error

        let kf_confusion_matrices_mean = divide(kf_confusion_matrices.reduce((a,b) => add(a,b), [[0,0],[0,0]]),
        kf_confusion_matrices.length);

        confusion_matrix_std_err = sqrt(divide(kf_confusion_matrices.reduce((a,b) => add(
          square(subtract(kf_confusion_matrices_mean, a)),
          square(subtract(kf_confusion_matrices_mean, b))
        )), n_folds));

        matrix = kf_confusion_matrices_mean;
        accuracy = mean(kf_accuracies);
        accuracy_std_err = std(kf_accuracies) / sqrt(n_folds);
      }

      // Update predictions
      const predictions = [];
      for (var i = 0; i < this.state.predictData.length; i++) {
        const prediction = this.state.predictData[i];
        const prob = prediction["__probability__"];
        const label = prediction[this.state.predicted_column];
        const pos_prob =  (label == evaluate.auc_curve.positive_label) ? prob : 1 - prob;
        prediction[this.state.predicted_column] =
            (pos_prob >= threshold)?
                evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
        prediction["__probability__"] = (pos_prob >= threshold)? pos_prob : 1 - pos_prob;
        predictions.push(prediction);
      }

      this.setState({
        evaluate: {
            ...this.state.evaluate,
            confusion_matrix: matrix,
            confusion_matrix_std_err: confusion_matrix_std_err,
            accuracy: accuracy,
            accuracy_std_err: accuracy_std_err,
            auc_curve: {
                ...this.state.evaluate.auc_curve,
                threshold: threshold
            }
        },
        predictData: predictions
      });
  }

  setData(taskId){
    this.props.actions.setPollingStatus(this.props.chartId, true);
    this.props.actions.setTaskId(this.props.chartId, taskId);
    const polling= setInterval(async function() {
          const result = await SupersetClient.get({
              endpoint: `/classification/api/task/${taskId}`
          });
      const chartData = result.json;
      const {status, messenger, validations, runtime, data, table} = chartData;
      if (status != 'PROCESSING') {
        if (validations && validations.length > 0) {
          let validation_message = '';
          for (let i = 0; i < validations.length; i++) {
            validation_message += `\n ${validations[i].level}: ${validations[i].message}`;
          }
          this.state.error_message = validation_message || messenger;
        }
        let message = this.state.error_message || '';
        this.setState({
            statusTrain: status,
            taskId,
            message,
        })
        if (status === 'SUCCESS') {
          const {
            fields, predictData, predict_explanations, validation_explanations, exdata,
            cross_validation_exdata, evaluate, importantFeatures,
            validation_table, prediction_table
          } = data;

          const newFields = fields.map(x => x.name);

          this.setState({
            fields: newFields,
            isPolling: false,
            exdata,
            predictData,
            cross_validation_exdata,
            evaluate,
            importantFeatures,
            table,
            validation_table,
            prediction_table,
          });
          this.props.actions.chartUpdateData(chartData, this.props.chartId);
          this.props.actions.setPollingStatus(this.props.chartId, false);
          if(!this.state.reQuery){
            this.props.actions.updateTaskid(this.props.chartId, this.state.taskId);
          }
          clearInterval(this.state.polling);
        }
      }
    }.bind(this), 2000);
    this.setState({ polling });
  }

  _cellTable({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const name = headerTable[columnIndex];
    if (rowIndex === 0) {
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={name}>
            <span>{name}</span>
          </TooltipWrapper>
        </div>
      );
    }else {
      let text = dataTable[name][rowIndex - 1] !== undefined ? dataTable[name][rowIndex - 1] : '';
      if(Number(text)){
        text = Number(text).toFixed(3);
      }
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  chartPerformance(state,width,height){
    let auc_curve = state.evaluate.auc_curve;

    // calculate std err for all threshold
    if (this.state.cross_validation_exdata !== undefined &&
      this.state.cross_validation_exdata.length >0 &&
      this.state.evaluate.auc_curve !== undefined){
      let evaluate = this.state.evaluate;
      const cross_validation_exdata = this.state.cross_validation_exdata;
      const n_folds = cross_validation_exdata.length;
      let tpr_std_errs = [];
      let fpr_std_errs = [];

      for (var i = 0; i < evaluate.auc_curve.thresholds.length; i++) {
        let threshold = evaluate.auc_curve.thresholds[i];
        let kf_tprs = [];
        let kf_fprs = [];
        for (var j = 0; j < cross_validation_exdata.length; j++) {
          let kf_split_exdata = cross_validation_exdata[j];
          let matrix = [[0, 0], [0, 0]];
          for (var k = 0; k < kf_split_exdata.length; k++) {
            const label = kf_split_exdata[k][this.state.predicted_column];
            var prob = kf_split_exdata[k]["__probability__"];
            if (label != evaluate.auc_curve.positive_label) {
                prob = 1 - prob;
            }
            var pred_label = (prob >= threshold) ? evaluate.auc_curve.positive_label:evaluate.auc_curve.negative_label;
            var true_label = kf_split_exdata[k][this.state.predicted_column];
            var row_id = (true_label==evaluate.auc_curve.positive_label)? 1:0;
            var col_id = (pred_label==evaluate.auc_curve.positive_label)? 1:0;
            matrix[row_id][col_id] += 1;
          }
          matrix = matrix.map((row, k) => {
            var sum = row.reduce((a, b) => a + b);
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
      let chart = [{
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
          <Plot
            data={chart}
            layout={layoutChart}
            onClick={this.handleClick}
          />
        </div>
      );
    }
    return '';
  }

  importantFeatures(importantFeatures){
    let showFeatures = false;
    if(importantFeatures !== undefined && importantFeatures.length > 0){ showFeatures = true; }
    return(
      <div id="table-performance" style={{"float":"left"}}>
        {showFeatures &&
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
              {importantFeatures.map((row,k) =>
                <tr>
                  <td>{row.feature}</td>
                  <td>
                    {row.importance.toFixed(3)}
                    {(row.importance_std_err !== undefined) && (
                      (<span style={{color: "red"}}>
                        &nbsp; &plusmn;{row.importance_std_err.toFixed(3)}
                      </span>)
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        }
      </div>
    );
  }


  // rerun query chart
  reQuery(){
    if (this.state.reQuery){
        this.setState({ reQuery: false });
        clearInterval(this.state.polling);
        // delete taskId
        axios.delete(`/api/task/${this.state.taskId}`);
        // rerun query
        this.props.actions.setTaskId(this.props.chartId, null);
        this.props.actions.triggerQuery(true, this.props.chartId);
    }
    return(<Loading size={50} />);
  }

  stopQuery(status){
    clearInterval(this.state.polling);
    // delete taskId
    axios.delete(`/api/task/${this.state.taskId}`);
    // stop query
    this.props.actions.setPollingStatus(this.props.chartId, false);
    this.props.actions.chartRenderingFailed(this.state.error_message, this.props.chartId, null);
    return `<div></div>`;
  }

  render() {
    const {
        width,
        height,
        formData,
    } = this.props;
    const { taskId } = formData;
    // check status
    if(taskId===null && !this.state.isLoading){
      this.setState({ reQuery: false, isLoading: false });
    }
    if ( this.state.statusTrain === 'REVOKED' || (this.state.statusTrain === 'PENDING' && this.props.chartId > 0) ){
      return this.reQuery();
    }else if (this.state.statusTrain === 'FAILURE' ){
      return this.stopQuery(this.state.statusTrain);
    }
    // get data table
    dataTable = this.state.table;
    headerTable = Object.keys(dataTable);
    let countTable = 0;
    let default_tab = (this.state.predictData.length > 0) ? "prediction": "performance";
    if(headerTable.length > 0){
      countTable = Object.keys(dataTable[headerTable[0]]).length;
    }
    // render chart
    const prediction_columns = this.state.fields.filter(columnName => columnName!==`${formData.prediction}_predicted`);
    this.state.predicted_column = formData.prediction;
    return (
        !this.state.isPolling ? (
          <StyledTabs
            defaultActiveKey={default_tab}
            id="tab-content"
          >
            {(!this.state.prediction_table) && (this.state.predictData.length > 0) &&
              <Tab eventKey="prediction" title="Prediction">
                <LegacyPredictionTable
                  records={this.state.predictData}
                  height={height} width={width}
                  predicted_column={formData.prediction}
                  columns={prediction_columns}
                />
              </Tab>
            }
            {(this.state.prediction_table) && (this.state.prediction_table.data[this.state.prediction_table.columns[0]].length > 0) &&
              <Tab eventKey="prediction" title="Prediction">
                <PredictionTable
                  records={this.state.prediction_table}
                  height={height} width={width}
                  data_columns={formData.all_columns.concat(formData.extra_columns)}
                />
              </Tab>
            }
            <Tab eventKey="performance" title="Performance">
              <MetricTable evaluate={this.state.evaluate}/>
              {this.chartPerformance(this.state,width,height)}
              <ConfusionMatrix
                labels={this.state.evaluate.labels}
                matrix={this.state.evaluate.confusion_matrix}
                matrix_std_err = {this.state.evaluate.confusion_matrix_std_err}
              />
              {this.importantFeatures(this.state.importantFeatures)}
              {(!this.state.validation_table) && (this.state.exdata.length > 0) &&
                <LegacyPredictionTable
                  records={this.state.exdata}
                  height={height} width={width}
                  predicted_column={formData.prediction}
                  columns={this.state.fields}
                />
              }
              {(this.state.validation_table) && (this.state.validation_table.data[this.state.validation_table.columns[0]].length > 0) &&
                <PredictionTable
                  records={this.state.validation_table}
                  height={height} width={width}
                  data_columns={formData.all_columns.concat(formData.extra_columns, formData.prediction)}
                />
              }
            </Tab>
            <Tab eventKey="table" title="Table">
              <div id="virtualized-table">
                <MultiGrid
                  columnCount={headerTable.length}
                  columnWidth={120}
                  fixedColumnCount={0}
                  fixedRowCount={1}
                  height={height-23}
                  cellRenderer={this._cellTable}
                  rowCount={countTable+1}
                  rowHeight={48}
                  width={width}
                  styleBottomRightGrid={{outline: `none`}}
                />
              </div>
            </Tab>
          </StyledTabs>
          ):(<div/>)
    );
  }
}

export default ClassificationPrediction;
