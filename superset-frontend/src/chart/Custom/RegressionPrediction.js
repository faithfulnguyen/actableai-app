import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { MultiGrid, CellMeasurerCache, CellMeasurer } from 'react-virtualized';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import axios from 'axios';
import TooltipWrapper from 'src/components/TooltipWrapper';

let reQuery = true;
let isLoading = true;

let indexPredict = 0;
let records = [];
let shaps = [];
let headerTable = [];
let dataTable = {};

class PredictionTable extends Component {

  constructor(props) {
    super(props);
    this._cellRenderer = this._cellRenderer.bind(this);
  }

  _cellRenderer({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const column = this.props.records.columns[columnIndex];
    if (rowIndex === 0) {
      return (
        <CellMeasurer
          cache={this.props.cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className="header" key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={column}>
              <span>{column}</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    } else {
      let stylePredict = {};
      if (this.props.highlights.includes(column)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
      }
      let shap = false;
      if (this.props.predictors) {
        const predictor_id = this.props.predictors.indexOf(column);
        shap =
          ((predictor_id >= 0 &&
          rowIndex - 1 < this.props.shaps.length &&
          predictor_id < this.props.shaps[rowIndex - 1].length)?
            this.props.shaps[rowIndex - 1][predictor_id]:false);
      }

      let text = this.props.records.data[column][rowIndex - 1];
      if(Number(text)){
        text = Number(text).toFixed(3);
      }
      return (
        <CellMeasurer
          cache={this.props.cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className={className} key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={text}>
              <span style={stylePredict}>
                {text}
                {shap && shap > 0 &&
                    <span style={{color: "blue"}}>
                        &nbsp;(+{shap.toFixed(2)})
                    </span>
                }
                {shap && shap < 0 &&
                    <span style={{color: "red"}}>
                        &nbsp;({shap.toFixed(2)})
                    </span>
                }
              </span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    }
  }

   render() {
     return(
      <div id="virtualized-table" style={{ float: "left", marginTop: "50px"}}>
        <MultiGrid
          columnCount={this.props.records["columns"].length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={this.props.height-23}
          cellRenderer={this._cellRenderer}
          rowCount={this.props.records["data"][this.props.records["columns"][0]].length+1}
          rowHeight={48}
          width={this.props.width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </div>
     );
   }
}


class LegacyPredictionTable extends Component {
  constructor(props) {
    super(props);
    this._cellRenderer = this._cellRenderer.bind(this);
  }

  _cellRenderer({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    if (rowIndex === 0) {
      return (
        <CellMeasurer
          cache={this.props.cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className="header" key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={this.props.columns[columnIndex]}>
              <span>{this.props.columns[columnIndex]}</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    } else {
      let stylePredict = {};
      if (columnIndex >= this.props.columns.indexOf(this.props.predicted_column)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
      }
      let text = this.props.records[rowIndex - 1][this.props.columns[columnIndex]] !== undefined ? this.props.records[rowIndex - 1][this.props.columns[columnIndex]] : '';
      if(Number(text)){
        text = Number(text).toFixed(3);
      }
      const shap = ((rowIndex - 1 < this.props.shaps.length && columnIndex < this.props.shaps[rowIndex - 1].length)?
      this.props.shaps[rowIndex - 1][columnIndex]:false);
      return (
        <CellMeasurer
          cache={this.props.cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className={className} key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={text}>
              <span style={stylePredict}>
                {text}
                {shap && shap > 0 &&
                    <span style={{color: "blue"}}>
                        &nbsp;(+{shap.toFixed(2)})
                    </span>
                }
                {shap && shap < 0 &&
                    <span style={{color: "red"}}>
                        &nbsp;({shap.toFixed(2)})
                    </span>
                }</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    }
  }


   render() {
     return(
      <div id="virtualized-table" style={{ float: "left", marginTop: "50px"}}>
        <MultiGrid
          columnCount={this.props.columns.length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={this.props.height-23}
          cellRenderer={this._cellRenderer}
          rowCount={this.props.records.length+1}
          rowHeight={48}
          width={this.props.width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </div>
     );
   }
}

class RegressionPrediction extends Component {
  constructor(props) {
    super(props);

    this._cellRenderer = this._cellRenderer.bind(this);
    this._cache = new CellMeasurerCache({
      defaultWidth: 120,
      fixedHeight: true,
    });

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
      polling: null,
      validation_shaps: [],
      predict_shaps: [],
      error_message: '',
    }
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.deleteTask.bind(this));
  }

  componentWillUnmount() {
    window.addEventListener('beforeunload', this.deleteTask.bind(this));
  }

  deleteTask() {
    if (this.state.statusTrain !== 'SUCCESS') {
      axios.delete(`/api/task/${this.state.taskId}`);
    }
  }

  UNSAFE_componentWillMount() {
    const { taskId } = this.props.queryResponse.data;
    this.setData(taskId);
  }

  UNSAFE_componentWillUpdate(nextProps, nextState, nextContext) {
    if (
      nextProps.queryResponse.data.taskId !==
      this.props.queryResponse.data.taskId
    ) {
      const { taskId } = nextProps.queryResponse.data;
      this.setData(taskId);
    }
    const nextIsPolling =
      nextProps.chart === undefined
        ? nextProps.isPolling
        : nextProps.chart.isPolling;
    const isPolling =
      this.props.chart === undefined
        ? this.props.isPolling
        : this.props.chart.isPolling;
    if (nextIsPolling !== isPolling) {
      if (!nextIsPolling) {
        clearInterval(this.state.polling);
      }
    }
  }

  setData(taskId) {
    this.props.actions.setPollingStatus(this.props.chartId, true);
    this.props.actions.setTaskId(this.props.chartId, taskId);
    const polling = setInterval(async function() {
      const result = await SupersetClient.get({
        endpoint: `/regression/api/task/${taskId}`,
      });

      const chartData = result.json;
      const {
        data,
        table,
        status,
        validations,
        messenger,
      } = chartData;
      if (status != 'PROCESSING') {
        if (validations && validations.length > 0) {
          let validation_message = '';
          for (let i = 0; i < validations.length; i++) {
            validation_message += `\n ${validations[i].level}: ${validations[i].message}`;
          }
          this.state.error_message = validation_message || messenger;
        }
        let message = this.state.error_message || '';
        this.setState({ statusTrain: status, taskId, message });
        if (status === 'SUCCESS') {
          const {
            fields,
            exdata,
            predictData,
            evaluate,
            importantFeatures,
            validation_shaps,
            predict_shaps,
            validation_table,
            prediction_table,
            intervention_table,
          } = data;

          let all_fields = [];
          if (predictData?.length > 0){
            all_fields = _.union(
              fields.map(x => x.name),
              Object.keys(predictData[0]),
            ).filter(item => item !== 'index');
          } else {
            all_fields = fields?.map(x => x.name).filter(item => item !== 'index');
          }
          this.setState({
            isPolling: false,
            fields: all_fields,
            exdata,
            predictData,
            evaluate,
            importantFeatures,
            validation_shaps,
            predict_shaps,
            table,
            validation_table,
            prediction_table,
            intervention_table,
          });
          clearInterval(this.state.polling);
          this.props.actions.chartUpdateData(chartData, this.props.chartId);
          this.props.actions.setPollingStatus(this.props.chartId, false);
          if (!reQuery) {
            this.props.actions.updateTaskid(
              this.props.chartId,
              this.state.taskId,
            );
          }
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
      const text = dataTable[name][rowIndex - 1];
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  tablePerformance(evaluate, importantFeatures) {
    // check show Metrics
    let showMetric = true;
    if (evaluate.RMSE === undefined || evaluate.R2 === undefined) {
      showMetric = false;
    }
    // check show importantFeatures
    let showFeatures = false;
    if (importantFeatures !== undefined && importantFeatures.length > 0) {
      showFeatures = true;
    }
    let show_std_err = false;
    if (evaluate.RMSE_std_err !== undefined && evaluate.R2_std_err !== undefined){
      show_std_err = true;
    }
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
                (<span style={{color: "red"}}>
                  &nbsp; &plusmn;{evaluate.RMSE_std_err.toFixed(3)}
                </span>)
              )}
            </label>
            <br />
            <strong style={{ width: '60px', display: 'inline-block' }}></strong>
            <label>
              <strong>R2</strong>: {evaluate.R2.toFixed(3)}
              {show_std_err && (
                (<span style={{color: "red"}}>
                  &nbsp; &plusmn;{evaluate.R2_std_err.toFixed(3)}
                </span>)
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
                <tr>
                  <td>{row.feature}</td>
                  <td>
                    {row.importance.toFixed(3)}
                    {show_std_err && (
                      (<span style={{color: "red"}}>
                        &nbsp; &plusmn;{row.importance_std_err.toFixed(3)}
                      </span>)
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

  reQuery() {
    if (reQuery) {
      reQuery = false;
      clearInterval(this.state.polling);
      // delete taskId
      axios.delete(`/api/task/${this.state.taskId}`);
      // rerun query
      this.props.actions.setTaskId(this.props.chartId, null);
      this.props.actions.triggerQuery(true, this.props.chartId);
    }
    return <Loading size={50} />;
  }

  stopQuery(status) {
    clearInterval(this.state.polling);
    // delete taskId
    axios.delete(`/api/task/${this.state.taskId}`);
    // stop query
    this.props.actions.setPollingStatus(this.props.chartId, false);
    this.props.actions.chartRenderingFailed(
      this.state.error_message,
      this.props.chartId,
      null,
    );
    return `<div></div>`;
  }

  render() {
    const { width, height, formData } = this.props;
    const { taskId } = formData;
    // check status
    if (taskId === null && !isLoading) {
      reQuery = false;
      isLoading = false;
    }
    if (
      this.state.statusTrain === 'REVOKED' ||
      (this.state.statusTrain === 'PENDING' && this.props.chartId > 0)
    ) {
      return this.reQuery();
    } else if (this.state.statusTrain === 'FAILURE') {
      return this.stopQuery(this.state.statusTrain);
    }
    // get data table
    dataTable = this.state.table;
    headerTable = Object.keys(dataTable);
    let countTable = 0;
    let default_tab = (this.state.prediction_table) ? "prediction": "performance";
    if(headerTable.length > 0){
      countTable = Object.keys(dataTable[headerTable[0]]).length;
    }
    // render chart
    const indexPredict = this.state.exdata?.length;
    const prediction_columns = this.state.fields?.filter(columnName => columnName!==`${formData.prediction}_predicted`);

    const target = formData.prediction;
    const predictors = formData.all_columns;

    return !this.state.isPolling ? (
      <Tabs defaultActiveKey={default_tab} id="tab-content">
        {(!this.state.prediction_table) && (this.state.predictData.length > 0) &&
          <Tab eventKey="prediction" title="Prediction">
              <LegacyPredictionTable
                records={this.state.predictData}
                shaps={this.state.predict_shaps}
                height={height}
                width={width}
                predicted_column={target}
                columns={prediction_columns}
                cache={this._cache}
              />
          </Tab>
        }
        {(this.state.prediction_table.data[
          Object.keys(this.state.prediction_table.data)[0]
        ]?.length > 0) &&
          <Tab eventKey="prediction" title="Prediction">
              <PredictionTable
                records={this.state.prediction_table}
                shaps={this.state.predict_shaps}
                predictors={predictors}
                height={height}
                highlights={[target + "_predicted", target + "_low", target + "_high"]}
                width={width}
                cache={this._cache}
              />
          </Tab>
        }
        <Tab eventKey="performance" title="Performance">
          {this.tablePerformance(
            this.state.evaluate,
            this.state.importantFeatures,
          )}
          {(!this.state.validation_table) && (this.state.exdata?.length > 0) &&
            <LegacyPredictionTable
              records={this.state.exdata}
              shaps={this.state.validation_shaps}
              height={height}
              width={width}
              predicted_column={formData.prediction}
              columns={this.state.fields}
              cache={this._cache}
            />
          }
          {(this.state.validation_table) &&
            <PredictionTable
              records={this.state.validation_table}
              shaps={this.state.validation_shaps}
              predictors={predictors}
              height={height}
              highlights={[target + "_predicted", target + "_low", target + "_high"]}
              width={width}
              cache={this._cache}
            />
          }
        </Tab>
        {(this.state.intervention_table) &&
          <Tab eventKey="counterfactual" title="Countefactual">
              <PredictionTable
                records={this.state.intervention_table}
                height={height}
                width={width}
                highlights={[
                  target + "_predicted",
                  target + "_predicted_low",
                  target + "_predicted_high",
                  target + "_intervened",
                  target + "_intervened_low",
                  target + "_intervened_high",
                  "intervention_effect",
                  "intervention_effect_low",
                  "intervention_effect_high",
                ]}
                cache={this._cache}
              />
          </Tab>
        }
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
      </Tabs>
    ) : (
       <div/>
    );
  }
}

export default RegressionPrediction;
