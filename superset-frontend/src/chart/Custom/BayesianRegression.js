import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { MultiGrid, CellMeasurerCache, CellMeasurer } from 'react-virtualized';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import TooltipWrapper from 'src/components/TooltipWrapper';
import Plot from 'react-plotly.js';
import quantile from 'distributions-normal-quantile';

let reQuery = true;
let isLoading = true;

const responsiveStyle = {
    width: '50vw',
    height: '40vw',
    margin: 'auto',
    minWidth: '600px',
    minHeigh: '450px',
};

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
      const predictors = this.props.formData.all_columns;
      if (columnIndex > predictors.length + ((this.props.prediction)? -1:0)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
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
              <span style={stylePredict}>{text}</span>
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

class BayesianRegression extends Component {
  constructor(props) {
    super(props);

    this.multivariateTab = this.multivariateTab.bind(this);
    this.univariateTab = this.univariateTab.bind(this);
    this.showLRChart = this.showLRChart.bind(this);

    this._cache = new CellMeasurerCache({
      defaultWidth: 120,
      fixedHeight: true,
    });

    this.state = {
      statusTrain: 'PROCESSING',
      messenger: '',
      taskId: null,
      prediction_table: [],
      evaluation: {},
      importantFeatures: [],
      table: {},
      isPolling: true,
      polling: null,
      error_message: '',
      reQuery: true,
      isLoading: true
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
    const polling = setInterval(
      async function() {
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
              coeffs,
              validation_table,
              prediction_table,
              evaluation,
            } = data;

            this.setState({
              isPolling: false,
              fields: Object.keys(table),
              validation_table,
              prediction_table,
              evaluation,
              coeffs,
              table,
            });
            // console.log(this.state);
            clearInterval(this.state.polling);
            this.props.actions.chartUpdateData(chartData, this.props.chartId);
            this.props.actions.setPollingStatus(this.props.chartId, false);
            if (!this.state.reQuery) {
              this.props.actions.updateTaskid(
                this.props.chartId,
                this.state.taskId,
              );
            }
          }
        }
      }.bind(this),
      2000,
    );
    this.setState({ polling });
  }
  tablePerformance(evaluation, importantFeatures) {
    // check show Metrics
    let showMetric = true;
    if (evaluation.rmse === undefined || evaluation.r2 === undefined) {
      showMetric = false;
    }
    // check show importantFeatures
    let showFeatures = false;
    if (importantFeatures !== undefined && importantFeatures.length > 0) {
      showFeatures = true;
    }
    return (
      <div id="table-performance">
        {showMetric && (
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
        )}
      </div>
    );
  }

  showLRChart(data, x, y_mean, y_std, quantile_low, quantile_high) {
    const low_quantiles = [];
    const high_quantiles = [];
    for (var i = 0; i < y_mean.length; i++) {
      let quantiles = quantile([quantile_low/100., quantile_high/100.], {
        'mu': y_mean[i],
        'sigma': y_std[i],
      });
      low_quantiles.push(quantiles[0]);
      high_quantiles.push(quantiles[1]);
    }

    const trace2 = {
      name: quantile_high + '% quantile',
      type: 'scatter',
      x: x,
      y: high_quantiles,
      fill: 'tonexty',
      line: { color: 'rgba(196, 196, 196, 0.88)' },
    };

    const trace1 = {
      name: quantile_low + '% quantile',
      type: 'scatter',
      x: x,
      y: low_quantiles,
      line: { color: 'rgba(196, 196, 196, 0.88)' },
    };

    const trace3 = {
      name: 'Regression',
      type: 'scatter',
      x: x,
      y: y_mean,
    };

    const trace4 = {
      mode: 'markers',
      name: 'Data points',
      type: 'scatter',
      x: data.x,
      y: data.y,
    };

    const traces = [trace1, trace2, trace3, trace4];
    const layout = {
      xaxis: {
        title: data.x_title,
        titlefont: {},
      },
      yaxis: {
        title: data.y_title,
        titlefont: {},
      },
      autosize: true,
      annotations: [
        {
          text: `R2 score: ${data.r2}`,
          align: 'left',
          showarrow: false,
          xref: 'paper',
          yref: 'paper',
          xanchor: 'left',
          x: 1.05,
          y: 0.1,
          bordercolor: 'black',
          borderwidth: 1,
        },
      ],
    };

    return (
      <Plot
        data={traces}
        layout={layout}
        style={responsiveStyle}
      ></Plot>
    );
  }

  multivariateTab(coeffs) {
    let containers = [];
    for (let i = 0; i < coeffs.length; i++) {
      for (let j = 0; j < coeffs[i].pdfs.length; j++) {
        containers.push(
          <>
            <Plot
              data={[
                  {
                      x: coeffs[i].pdfs[j][0],
                      y: coeffs[i].pdfs[j][1],
                      type: 'scatter',
                      mode: 'lines+points',
                      marker: { color: '#83dfe2' },
                      line: { shape: 'spline' },
                      fill: 'tonexty',
                      name: '',
                      showlegend: false,
                  },
              ]}
              layout={{
                  autosize: true,
                  xaxis: {
                    title: coeffs[i].name + (j==0? "":"^" + (j + 1)),
                  },
                  yaxis: {
                      title: 'Density',
                  },
                  showlegend: true,
                  legend: {
                      orientation: 'h',
                  },
              }}
              style={responsiveStyle}
            />
          </>
        );
      }
    }
    return containers;
  }

  univariateTab(coeffs) {
    let containers = [];
    for (let i = 0; i < coeffs.length; i++) {
      if (coeffs[i].name in this.state.table.data) {
        containers.push(
          <>
            {this.showLRChart({
                x: this.state.table["data"][coeffs[i].name],
                y: this.state.table["data"][this.props.formData.prediction],
                r2: coeffs[i].univariate.r2,
                x_title: coeffs[i].name,
                y_title: this.props.formData.prediction,
              },
              coeffs[i].univariate.x,
              coeffs[i].univariate.y_mean,
              coeffs[i].univariate.y_std,
              this.props.formData.regression_quantile_low,
              this.props.formData.regression_quantile_high)}
          </>
        );
      }
      for (let j = 0; j < coeffs[i].univariate.pdfs.length; j++) {
        containers.push(
          <>
            <Plot
              data={[
                {
                  x: coeffs[i].univariate.pdfs[j][0],
                  y: coeffs[i].univariate.pdfs[j][1],
                  type: 'scatter',
                  mode: 'lines+points',
                  marker: { color: '#83dfe2' },
                  line: { shape: 'spline' },
                  fill: 'tonexty',
                  name: '',
                  showlegend: false,
                },
              ]}
              layout={{
                  autosize: true,
                  xaxis: {
                    title: coeffs[i].name + (j==0? "":"^" + (j + 1)),
                  },
                  yaxis: {
                      title: 'Density',
                  },
                  showlegend: true,
                  legend: {
                      orientation: 'h',
                  },
              }}
              style={responsiveStyle}
            />
          </>
        );
      }
    }
    return containers;
  }

  reQuery() {
    if (this.state.reQuery) {
      this.setState({ reQuery: false });
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
    if(taskId===null && !this.state.isLoading){
      this.setState({ reQuery: false, isLoading: false });
    }
    if (
      this.state.statusTrain === 'REVOKED' ||
      (this.state.statusTrain === 'PENDING' && this.props.chartId > 0)
    ) {
      return this.reQuery();
    } else if (this.state.statusTrain === 'FAILURE') {
      return this.stopQuery(this.state.statusTrain);
    }

    // Render chart
    const default_tab = (this.state.prediction_table)? "prediction":"performance";
    return !this.state.isPolling ? (
      <Tabs defaultActiveKey={default_tab} id="tab-content">
        {(this.state.prediction_table) &&
          <Tab eventKey="prediction" title="Prediction">
              <PredictionTable
                records={this.state.prediction_table}
                formData={formData}
                height={height}
                width={width}
                cache={this._cache}
                prediction={true}
              />
          </Tab>
        }
        <Tab eventKey="performance" title="Performance">
          {this.tablePerformance(
            this.state.evaluation,
            this.state.importantFeatures,
          )}
          {(this.state.validation_table) &&
            <PredictionTable
              records={this.state.validation_table}
              height={height}
              width={width}
              cache={this._cache}
              formData={formData}
            />
          }
        </Tab>
        <Tab eventKey="multivariate" title="Multivariate">
          <>
            {this.multivariateTab(this.state.coeffs)}
          </>
        </Tab>
        <Tab eventKey="univariate" title="Univariate">
          <>
            {this.univariateTab(this.state.coeffs)}
          </>
        </Tab>
        <Tab eventKey="table" title="Table">
          <div id="virtualized-table">
            <PredictionTable
              records={this.state.table}
              height={height}
              width={width}
              cache={this._cache}
              formData={formData}
            />
          </div>
        </Tab>
      </Tabs>
    ) : (
       <div/>
    );
  }
}

export default BayesianRegression;
