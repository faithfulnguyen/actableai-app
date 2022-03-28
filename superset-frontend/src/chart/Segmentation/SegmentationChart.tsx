import { t } from '@superset-ui/translation';
import { color } from 'd3-color';
import { Data, Layout } from 'plotly.js';
import React, { useMemo } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';
import { useChart } from 'src/hooks/useChart';
import DynamicChart from '../DynamicChart';
import { getIdColor } from '../Plotly/Common';

function SegmentationChart({
  actions, chart, formData, width, height,
}: IChartProps) {
  const { chartData, reQuery } = useChart<any>({
    actions, chart, vizType: 'tsne',
    processChartData: (chartData) => {
      if(chartData.status !== 'SUCCESS') return chartData;
      const nextChartData = { ...chartData };
      nextChartData.data = [...nextChartData.data.sort((c1: any, c2: any) => c1["cluster_id"] - c2["cluster_id"])];
      return nextChartData;
    }
  });

  const { x_axis_label, left_margin, y_axis_label, bottom_margin, group, max_bubble_size, hover } = formData;

  const layouts = useMemo<Partial<Layout>>(() => ({
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
  }), [width, height, x_axis_label, left_margin, y_axis_label, bottom_margin]);

  const trace = useMemo(() => {
    if (chartData?.status !== 'SUCCESS') return [];
    let trace: Data[] = [];
    let color_colums: string[] = [];
    for (let index = 0; index < chartData.data.length; index++) {
      let cX = [];
      let cY = [];
      let cText = [];
      let cColor = [];
      const values = chartData.data[index].value;
      const cluster_id = chartData.data[index].cluster_id;
      const cluster_hover = "cluster_id: " + cluster_id + "<br>";
      for (let i = 0; i < values.length; i++) {
        cX.push(values[i].train.x);
        cY.push(values[i].train.y);
        const column = values[i].column;
        let text = hover.includes("cluster_id") ? cluster_hover : "";
        for (const key in column) {
          if(hover.includes(key)) {
            text += key + ": " + column[key] + "<br>";
          }
        }
        if (group != 'cluster_id') {
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
      trace.push({
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
      });
    }
    return trace;
  }, [chartData?.status])


  if(chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />

  const { table, data } = chartData;
  const headerTable = Object.keys(table);
  
  const columns: string[] = [];
  const records: string[][] = [];
  let index = 0;
  if (chartData.data.length > 0 && chartData.data[0]["value"] !== undefined && chartData.data[0]["value"].length > 0){
    let column_key = chartData.data[0]["value"][0]["column"];
    for (let key in column_key){
      columns.push(key);
    }
  }
  for(let i=0; i<chartData.data.length; i++){
    const row = chartData.data[i];
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
  let countTable = headerTable.length > 0 ? Object.keys(table[headerTable[0]]).length : 0;
  
  return (
    <DynamicChart chartData={chartData} reQuery={reQuery}>
      <Tabs defaultActiveKey="chart" id="tab-content" mountOnEnter>
        <Tab eventKey="chart" title="Chart">
          <Plot data={trace} layout={layouts} />
        </Tab>
        <Tab eventKey="clusters" title="Clusters">
          <DynamicMultiGrid
              getContent={({ rowIndex, columnIndex }) => {
                if(rowIndex === 0) {
                  if (columnIndex === 0) return t('Cluster Id');
                  return t('Explanation');
                }
                return data[rowIndex-1][['cluster_id', 'explanation'][columnIndex]];
              }}
              width={width}
              height={height-23}
              rowCount={data.length + 1}
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
                return table[headerTable[columnIndex]][rowIndex - 1];
              }}
              width={width}
              height={height-23}
              rowCount={countTable+1}
              columnCount={headerTable.length}
            />
          </div>
        </Tab>
      </Tabs>
    </DynamicChart>
  );
}

export default SegmentationChart;
