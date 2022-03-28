import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useChart } from 'src/hooks/useChart';
import DynamicChart from '../DynamicChart';
import PerformanceTable from './MetricTable';
import PredictionTable from './PredictionTable';
import MultiVariateTab from './MultiVariateTab';
import UniVariateTab from './UniVariateTab';

function BayesianRegressionChart({ actions, chart, width, height, formData }: IChartProps) {
  const { chartData, reQuery } = useChart<any>({
    actions, chart, vizType: 'regression'
  })
  
  if(chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />

  const { prediction_table, evaluation, validation_table, coeffs } = chartData.data;
  const table = chartData.table as any;

  // Render chart
  return (
    <DynamicChart
      chartData={chartData}
      reQuery={reQuery}
    >
      {chartData ? (
        <Tabs id="tab-content" mountOnEnter>
          {prediction_table && (
            <Tab eventKey="prediction" title="Prediction">
              <PredictionTable
                records={prediction_table}
                formData={formData}
                height={height}
                width={width}
                prediction={true}
              />
            </Tab>
          )}
          <Tab eventKey="performance" title="Performance">
            <PerformanceTable evaluation={evaluation} />
            <PredictionTable
              records={validation_table}
              height={height}
              width={width}
              formData={formData}
            />
          </Tab>
          <Tab eventKey="multivariate" title="Multivariate">
            <MultiVariateTab analyses={coeffs.multivariate} />
          </Tab>
          <Tab eventKey="univariate" title="Univariate">
            <UniVariateTab coeffs={coeffs} table={table} formData={formData}/>
          </Tab>
          <Tab eventKey="table" title="Table">
            <div id="virtualized-table">
              <PredictionTable
                records={table}
                height={height}
                width={width}
                formData={formData}
              />
            </div>
          </Tab>
        </Tabs>
      ) : <></>}
    </DynamicChart>
  );
}

export default BayesianRegressionChart;
