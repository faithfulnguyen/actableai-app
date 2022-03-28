import React, { Component } from 'react';
import Plot from 'react-plotly.js';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading'
import axios from 'axios';
import { MultiGrid } from 'react-virtualized';
import { Tab, Tabs } from 'react-bootstrap';
import TooltipWrapper from 'src/components/TooltipWrapper';
import { getColorScheme, getIdColor } from './Common';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';
import { t } from '@superset-ui/translation';

let reQuery = true;
let isLoading = true;
let columns = [];
let records = [];
let headerTable = [];
let dataTable = {};

class PlotlyTsne extends Component {
  constructor(props) {
    super(props);

    this.state = {
      statusTrain: 'PROCESSING',
      messenger: '',
      taskId: null,
      data: {
        key: "",
        value: [
            {
                "train":{},
                "column":{}
            },
        ],
      },
      table: {},
      isPolling: true,
      polling: null,
      validations: [],
      error_message: '',
    }
    this.deleteTask = this.deleteTask.bind(this);
  }

  componentDidMount(){
    window.addEventListener("beforeunload", this.deleteTask);
  }

  componentWillUnmount(){
    window.removeEventListener("beforeunload", this.deleteTask);
  }

  deleteTask(){
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

  setData(taskId){
    this.props.actions.setPollingStatus(this.props.chartId, true);
    this.props.actions.setTaskId(this.props.chartId, taskId);
    //
    const polling = setInterval(async function() {
          const result = await SupersetClient.get({
              endpoint: `/tsne/api/task/${taskId}`
          });
      const chartData = result.json;
      const {data, table, status, validations, messenger} = chartData;
      if (status != 'PROCESSING') {
        if (validations && validations.length > 0) {
          let validation_message = '';
          for (let i = 0; i < validations.length; i++) {
            validation_message += `\n ${validations[i].level}: ${validations[i].message}`;
          }
          this.state.error_message = validation_message || messenger;
        }
        let message = this.state.error_message || '';
        data.sort((c1, c2) => c1["cluster_id"] - c2["cluster_id"]);
        this.setState({ statusTrain: status, taskId, data, table, message });
        if (status === 'SUCCESS') {
          this.setState({ isPolling:false });
          clearInterval(this.state.polling);
          this.props.actions.chartUpdateData(chartData, this.props.chartId);
          this.props.actions.setPollingStatus(this.props.chartId, false);
          if(!reQuery){
            this.props.actions.updateTaskid(this.props.chartId, this.state.taskId);
          }
        }
      }
    }.bind(this), 2000);
    this.setState({ polling });
  }

  reQuery(){
    if (reQuery){
        reQuery = false;
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
          queryResponse,
      } = this.props;
      const {
          taskId,
          // Query
          timeline,
          group,
          hover,
          max_bubble_size,
          duration,
          // Customize
          color_scheme,
          x_axis_label,
          left_margin,
          y_axis_label,
          bottom_margin,
      } = formData;
      // check status
      if(taskId===null && !isLoading){
          reQuery = false;
          isLoading = false;
      }
      if ( this.state.statusTrain === 'REVOKED' || (this.state.statusTrain === 'PENDING' && this.props.chartId > 0) ){
          return this.reQuery();
      }else if (this.state.statusTrain === 'FAILURE'){
          return this.stopQuery(this.state.statusTrain);
      }
      // render tsne chart
      const dataRespon = this.state.data;
      const color = getColorScheme(color_scheme);
      let trace = [];
      let color_colums = [];
      for (let index = 0; index < dataRespon.length; index++) {
          let cX = [];
          let cY = [];
          let cText = [];
          let cColor = [];
          const values = dataRespon[index].value;
          const cluster_id = dataRespon[index].cluster_id;
          const cluster_hover = "cluster_id: " + cluster_id + "<br>";
          for (let i = 0; i < values.length; i++) {
              cX.push(values[i].train.x);
              cY.push(values[i].train.y);
              const column = values[i].column;
              let text = hover.includes("cluster_id") ? cluster_hover : "";
              for (const key in column) {
                  if(hover.includes(key)){
                    text += key + ": " + column[key] + "<br>";
                  }
              }
              if(group != 'cluster_id') {
                color_colums.push(column[group]);
                color_colums = [...new Set(color_colums)]
                cColor.push(color[getIdColor(color.length, color_colums.indexOf(column[group]))]);
              }
              else {
                cColor = color[getIdColor(color.length,index)]
              }
              cText.push(text);
          }
          // add data
          trace.push(
              {
                  mode: 'markers',
                  name: 'Cluster ' + cluster_id,
                  type: 'scatter',
                  marker: {
                      sizemode: 'area',
                      symbol: '.',
                      size: max_bubble_size,
                      color: cColor
                  },
                  x: cX,
                  y: cY,
                  text: cText,
                  hoverinfo: 'text',
              }
          );
      }
      // layout
      const layouts = {
          width,
          height,
          margin: {
              t: 40,
              l: left_margin,
              b: bottom_margin,
          },
          showlegend: true,
          hovermode: 'closest',
          xaxis: {
              title: x_axis_label,
              autorange: true,
              showticklabels: false,
              visible: false,
          },
          yaxis: {
              title: y_axis_label,
              autorange: true,
              showticklabels: false,
              visible: false,
          },
      };
      //
      columns = [];
      records = [];
      let index = 0;
      if (dataRespon.length>0 && dataRespon[0]["value"] !== undefined && dataRespon[0]["value"].length > 0){
        let column_key = dataRespon[0]["value"][0]["column"];
        for (let key in column_key){
          columns.push(key);
        }
      }
      for(let i=0; i<dataRespon.length; i++){
        const row = dataRespon[i];
        for(let j=0; j<row.value.length; j++){
          let record = [];
          record.push(row.cluster_id);
          record.push(row.value[j].train.x);
          record.push(row.value[j].train.y);
          for(let k=0; k<columns.length; k++){
            record.push(row.value[j].column[columns[k]]);
          }
          records[index] = record;
          index++;
        }
      }
      columns.unshift("cluster_id","projected_x","projected_y");
      // get data table
      dataTable = this.state.table;
      headerTable = Object.keys(dataTable);
      let countTable = 0;
      if(headerTable.length > 0){
        countTable = Object.keys(dataTable[headerTable[0]]).length;
      }
      // render chart
      return (
          !this.state.isPolling ? (
            <Tabs defaultActiveKey="chart" id="tab-content" mountOnEnter>
              <Tab eventKey="chart" title="Chart">
                <Plot
                  data={trace}
                  layout={layouts}
                />
              </Tab>
              <Tab eventKey="clusters" title="Clusters">
                <DynamicMultiGrid
                    getContent={({ rowIndex, columnIndex }) => {
                      if(rowIndex === 0) {
                        if (columnIndex === 0) return t`Cluster Id`;
                        return t`Explanation`;
                      }
                      return this.state.data[rowIndex-1][['cluster_id', 'explanation'][columnIndex]];
                    }}
                    width={width}
                    height={height-23}
                    rowCount={this.state.data.length + 1}
                    columnCount={2}
                    highlight={/\d+%|[^ ]+? [^ ]+? [^ ]+?(?= and| are)/g}
                    doNotVirtualize
                  />
              </Tab>
              <Tab eventKey="data" title="Data">
                <div id="virtualized-table">
                  <DynamicMultiGrid
                    getContent={({ rowIndex, columnIndex }) => {
                      if(rowIndex === 0) return columns[columnIndex];
                      return records[rowIndex-1][columnIndex];
                    }}
                    width={width}
                    height={height-23}
                    rowCount={records.length + 1}
                    columnCount={columns.length}
                  />
                </div>
              </Tab>
              <Tab eventKey="table" title="Table">
                <div id="virtualized-table">
                  <DynamicMultiGrid
                    getContent={({ rowIndex, columnIndex }) => {
                      if(rowIndex === 0) return headerTable[columnIndex];
                      return dataTable[headerTable[columnIndex]][rowIndex - 1];
                    }}
                    width={width}
                    height={height-23}
                    rowCount={countTable+1}
                    columnCount={headerTable.length}
                  />
                </div>
              </Tab>
            </Tabs>
          ):(<Loading size={50} />)
      );
  }
}

export default PlotlyTsne;
