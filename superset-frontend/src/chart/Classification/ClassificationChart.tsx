import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';
import { useChart } from 'src/hooks/useChart';
import styled from 'styled-components';
import DynamicChart from '../DynamicChart';
import ConfusionMatrix from './ConfusionMatrix';
import ImportantFeatures from './ImportantFeatures';
import LegacyPredictionTable from './LegacyPredictionTable';
import MetricTable from './MetricTable';
import PerformanceChart from './PerformanceChart';
import PredictionTable from './PredictionTable';
import DebiasingChart from 'src/components/DebiasingChart';

const StyledTabs = styled(Tabs)`
  & .tab-content {
    overflow: auto;
  }
`;

interface IClassificationChartProps {
  actions: Record<string, () => void>;
  chart: any;
  width: number;
  height: number;
  formData: any;
}

function ClassificationChart({ actions, chart, width, height, formData }: IClassificationChartProps) {
  const { 
    chartData, setChartData, reQuery,
  } = useChart<IClassificationAnalysisData<TClassificationEvaluationDetails>>({ actions, chart, vizType: 'classification' });
  
  if(chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />

  const { prediction_table, predictData, validation_table, exdata, fields, debiasing_charts } = chartData?.data || {};
  const table = chartData?.table || {};
  
  const predicted_column = formData.prediction;
  const headerTable = Object.keys(table || {});
  const countTable = headerTable.length > 0 ? Object.keys(table[headerTable[0]]).length : 0;

  return (
    <DynamicChart
      chartData={chartData}
      reQuery={reQuery}
    >
      {chartData ? (
        <StyledTabs id="tab-content" mountOnEnter>
          {!prediction_table && predictData && (predictData.length > 0) &&
            <Tab eventKey="prediction" title="Prediction">
              <LegacyPredictionTable
                records={predictData}
                height={height}
                width={width}
                predicted_column={predicted_column}
                columns={(fields as unknown as string[])?.filter((columnName: any) => columnName !== `${predicted_column}_predicted`)}
              />
            </Tab>
          }
          {prediction_table && prediction_table.data[prediction_table.columns[0]].length > 0 &&
            <Tab eventKey="prediction" title="Prediction">
              <PredictionTable
                records={prediction_table}
                height={height}
                width={width}
              />
            </Tab>
          }
          <Tab eventKey="performance" title="Performance">
            <MetricTable chartData={chartData}/>
            <PerformanceChart 
              chartData={chartData}
              setChartData={setChartData}
              width={width}
              height={height}
              predicted_column={predicted_column}
            />
            <ConfusionMatrix chartData={chartData} />
            <ImportantFeatures chartData={chartData} />
            {!validation_table && exdata && exdata.length > 0 && (
              <LegacyPredictionTable
                records={exdata}
                height={height}
                width={width}
                predicted_column={formData.prediction}
                columns={fields as unknown as string[]}
              />
            )}
            {validation_table && validation_table.data[validation_table.columns[0]].length > 0 && (
              <PredictionTable
                records={validation_table}
                height={height}
                width={width}
              />
            )}
          </Tab>
          {debiasing_charts && debiasing_charts.length > 0 && (
            <Tab eventKey="debiasing" title="Debiasing">
              {debiasing_charts.map((groupData, index) => (
                <DebiasingChart
                  groupData={groupData}
                  key={index.toString()}
                  width={width}
                />
              ))}
            </Tab>
          )}
          <Tab eventKey="table" title="Table">
            <div id="virtualized-table">
              <DynamicMultiGrid
                getContent={({ rowIndex, columnIndex }) => {
                  const name = headerTable[columnIndex];
                  if (rowIndex === 0) return name;
                  return table[name][rowIndex - 1];
                }}
                columnCount={headerTable.length}
                height={height}
                rowCount={countTable + 1}
                width={width}
              />
            </div>
          </Tab>
        </StyledTabs>
      ) : <></>}
    </DynamicChart>
  );
}

export default ClassificationChart;
