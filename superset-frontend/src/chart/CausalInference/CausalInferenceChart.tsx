import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';
import CausalGraph from 'src/components/GraphViz/CausalGraph';
import GraphViz from 'src/components/GraphViz/GraphViz';
import { useChart } from 'src/hooks/useChart';
import DynamicChart from '../DynamicChart';
import EffectPlot from './EffectPlot';
import ValidationTable from './ValidationTable'

function CausalInferenceChart({ chart, actions, formData, width, height }: IChartProps) {
  const { chartData, reQuery } = useChart<any>({ chart, actions, vizType: 'causal_inference' });
  
  if(chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />

  
  const { table, data } = chartData;
  const headers = Object.keys(table);

  return (
    <DynamicChart reQuery={reQuery} chartData={chartData}>
      <Tabs defaultActiveKey="treatment-effect" id="tab-content">
        <Tab eventKey="treatment-effect" title="Treatment effect">
          <EffectPlot chartData={chartData} formData={formData} width={width} height={height}/>
          <GraphViz
            id="tree"
            width={width}
            height={height / 2}
            renderDot={data.tree_interpreter_dot}
            scale={0.8}
          />
        </Tab>
        <Tab eventKey="graph" title="Causal graph">
          <CausalGraph
            id="causal-graph"
            width={width}
            height={height}
            renderDot={data.causal_graph_dot}
            scale={0.9}
            formData={formData}
          />
        </Tab>
        {data.model_y_scores && (
          <Tab eventKey="validation" title="Validation">
              <ValidationTable data={data} />
          </Tab>
        )}
        <Tab eventKey="table" title="Table">
          <div id="virtualized-table">
            <DynamicMultiGrid
              getContent={({ rowIndex, columnIndex }) => {
                const header = headers[columnIndex];
                if (rowIndex===0) return header;
                return table[header][rowIndex - 1];
              }}
              columnCount={headers.length}
              rowCount={Object.keys(table[headers[0]]).length + 1}
              width={width}
              height={height-23}
            />
          </div>
        </Tab>
      </Tabs>
    </DynamicChart>
  );
}

export default CausalInferenceChart;
