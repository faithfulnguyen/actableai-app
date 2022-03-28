import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { MultiGrid } from 'react-virtualized';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import axios from 'axios';
import TooltipWrapper from 'src/components/TooltipWrapper';
import BaseChart from '../BaseChart';

let reQuery = true;
let isLoading = true;
let columns = [];
let records = [];
let headerTable = [];
let dataTable = {};

class CleanData extends BaseChart {
  constructor(props) {
    super(props);
    this._cellRenderer = this._cellRenderer.bind(this);
  }

  taskUrl(taskId) {
    return `/cleandata/api/task/${taskId}`;
  }

  _cellRenderer({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    if (rowIndex === 0) {
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={columns[columnIndex]}>
            <span>{columns[columnIndex]}</span>
          </TooltipWrapper>
        </div>
      );
    } else {
      let text = records[rowIndex - 1]['text'][columns[columnIndex]] !== undefined ? records[rowIndex - 1]['text'][columns[columnIndex]] : '';
      if(Number(text)){
        text = Number(text).toFixed(3);
      }
      let oldtext = records[rowIndex - 1]['oldtext'];
      if (oldtext === undefined) {
        oldtext = '';
      } else {
        oldtext = oldtext[columns[columnIndex]];
      }
      const classColor =
        'text ' + records[rowIndex - 1]['class'][columns[columnIndex]];
      let tooltip = text;
      if (classColor === 'text highlight') {
        tooltip += ' (' + oldtext + ')';
      }
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={tooltip}>
            <span className={classColor}>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
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

  renderCharts() {
    const { width, height, queryResponse, formData } = this.props;
    const { taskId } = formData;
    columns = this.state.chartData.data.columns;
    records = this.state.chartData.data.records;
    // get data table
    dataTable = this.state.chartData.table;
    headerTable = Object.keys(dataTable);
    let countTable = 0;
    if(headerTable.length > 0){
      countTable = Object.keys(dataTable[headerTable[0]]).length;
    }
    // render chart
    return (
      <Tabs defaultActiveKey="clean-data" id="tab-content">
        <Tab eventKey="clean-data" title="Clean Data">
          <div id="virtualized-table">
            <MultiGrid
              columnCount={columns.length}
              columnWidth={120}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height + 30}
              cellRenderer={this._cellRenderer}
              rowCount={records.length + 1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{ outline: `none` }}
            />
          </div>
        </Tab>
        <Tab eventKey="table" title="Table">
          <div id="virtualized-table">
            <MultiGrid
              columnCount={headerTable.length}
              columnWidth={120}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height + 30}
              cellRenderer={this._cellTable}
              rowCount={countTable + 1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{ outline: `none` }}
            />
          </div>
        </Tab>
      </Tabs>
    );
  }
}

export default CleanData;
