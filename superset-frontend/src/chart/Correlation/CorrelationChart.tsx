import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import _ from 'lodash';
import { GridCellRenderer, MultiGrid } from 'react-virtualized';
import TooltipWrapper from 'src/components/TooltipWrapper';
import { useChart } from 'src/hooks/useChart';
import DynamicChart from '../DynamicChart';
import ChartTitle from './ChartTitle';
import LRChart from './LRChart';
import CmChart from './CMChart';
import { CHART_TYPE } from './shared';
import LineChart from './LineChart';
import PosNegChart from './PosNegChart';


function CorrelationChart({ width, height, chart, actions, formData }: IChartProps) {
  const { chartData, reQuery } = useChart<any>({ chart, actions, vizType: 'causal_inference' });
  
  if (chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />

const renderChart = (chartData: any, corrData: any, index: number) => {
  switch (chartData.type) {
    case CHART_TYPE.LINEAR_REGRESSION:
      return <LRChart chartData={chartData} index={index} />
    case CHART_TYPE.CONFUSION_MATRIX:
      return <CmChart chartData={chartData} corrData={corrData} index={index} />
    case CHART_TYPE.KERNEL_DENSITY_ESTIMATION:
      return <LineChart chartData={chartData} index={index} />
    default:
      return;
  }
}

  const _cellTable = (headers: string[], data: any): GridCellRenderer => {
    return ({ columnIndex, key, parent, rowIndex, style }) => {
      const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
      const name = headers[columnIndex];
      if (rowIndex === 0) {
        return (
          <div className="header" key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={name}>
              <span>{name}</span>
            </TooltipWrapper>
          </div>
        );
      } else {
        const text = data[name][rowIndex - 1];
        return (
          <div className={className} key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={text}>
              <span>{text}</span>
            </TooltipWrapper>
          </div>
        );
      }
    }
  }

  const initialDataTableData = {
    'Compared factors': {},
    'Spearman\'s R': {},
    'P Value': {},
  }
  let tableHeaders = [];
  let tableData = {};

  let dataTableHeaders = [];
  let dataTableData = [];
  tableData = chartData.table;
  tableHeaders = Object.keys(tableData);
  dataTableData = chartData.data.corr?.reduce((p: any, c: any, i: number) => {
      p['Compared factors'][i]=Array.isArray(c.col)?c.col.join(' = '):c.col;
      p['Spearman\'s R'][i]=c.corr;
      p['P Value'][i]=c.pval;
      return p;
  }, initialDataTableData) || initialDataTableData;
  dataTableHeaders = ['Compared factors', 'Spearman\'s R', 'P Value'];
  let tableLength = tableHeaders.length > 0 ? Object.keys(tableData[tableHeaders[0]]).length : 0;
  let dataTableLength = dataTableHeaders.length > 0 ? Object.keys(dataTableData[dataTableHeaders[0]]).length : 0;
  // render chart
  return (
    <Tabs defaultActiveKey="chart" id="tab-content">
      <Tab eventKey="chart" title="Chart">
        <>
          <PosNegChart chartData={chartData} formData={formData} />
          {chartData.data.charts.map((item: any, index: number) => {
            return (
              <>
                {renderChart(
                  item,
                  chartData.data.corr[index],
                  index,
                )}
                <ChartTitle compareFactor={chartData.data.corr[index]} chartType={item.type} formData={formData}/>
              </>
            );
          })}
      </>
    </Tab>
    <Tab eventKey="data" title="Data">
        <div id="virtualized-table">
            <MultiGrid
              columnCount={dataTableHeaders.length}
              columnWidth={width/3}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height-23}
              cellRenderer={_cellTable(dataTableHeaders, dataTableData)}
              rowCount={dataTableLength+1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{ outline: `none`, overflowY: 'auto'}}
            />
        </div>
    </Tab>
    <Tab eventKey="table" title="Table">
        <div id="virtualized-table">
            <MultiGrid
              columnCount={tableHeaders.length}
              columnWidth={120}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height-23}
              cellRenderer={_cellTable(tableHeaders, tableData)}
              rowCount={tableLength+1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{ outline: `none`, overflowY: 'auto'}}
            />
        </div>
      </Tab>
    </Tabs>
  );
}

export default CorrelationChart;
