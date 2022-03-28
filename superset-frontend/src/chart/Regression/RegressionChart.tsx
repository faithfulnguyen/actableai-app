import _ from 'lodash';
import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';
import { useChart } from 'src/hooks/useChart';
import DynamicChart from '../DynamicChart';
import LegacyPredictionTable from './LegacyPredictionTable';
import PerformanceTable from './PerformanceTable';
import PredictionTable from './PredictionTable';
import DebiasingChart from 'src/components/DebiasingChart';

function RegressionChart({ chart, actions, width, height, formData}: IChartProps) {
  const { chartData, reQuery } = useChart<IRegressionAnalysisData>({
    actions, chart, vizType: 'regression'
  })
  
  if(chartData?.status !== 'SUCCESS') return <DynamicChart reQuery={reQuery} chartData={chartData} />
  
  const dataTable = chartData.table;
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
    debiasing_charts
  } = chartData.data;

  const headerTable = Object.keys(dataTable);
  const countTable = headerTable.length > 0 ? Object.keys(dataTable[headerTable[0]]).length : 0;
  // render chart
  
  let all_fields = [];
  if (predictData && predictData?.length > 0){
    all_fields = _.union(
      fields.map((field: any) => field.name),
      Object.keys(predictData[0]),
    ).filter(item => item !== 'index');
  } else {
    all_fields = fields?.map((field: any) => field.name).filter((item: string) => item !== 'index');
  }

  const prediction_columns = all_fields?.filter((columnName: string) => columnName!==`${formData.prediction}_predicted`);
  const { all_columns: predictors, prediction } = formData;

  return (
    <DynamicChart reQuery={reQuery} chartData={chartData}>
      <Tabs id="tab-content" mountOnEnter>
        {!prediction_table && predictData && predictData.length > 0 &&
          <Tab eventKey="prediction" title="Prediction">
            <LegacyPredictionTable
              records={predictData}
              shaps={predict_shaps}
              height={height}
              width={width}
              predicted_column={prediction}
              columns={prediction_columns}
            />
          </Tab>
        }
        {prediction_table.data[Object.keys(prediction_table.data)[0]]?.length > 0 && (
          <Tab eventKey="prediction" title="Prediction">
            <PredictionTable
              records={prediction_table}
              shaps={predict_shaps}
              predictors={predictors}
              height={height}
              highlights={[prediction + "_predicted", prediction + "_low", prediction + "_high"]}
              width={width}
            />
          </Tab>
        )}
        <Tab eventKey="performance" title="Performance">
          <PerformanceTable evaluate={evaluate} importantFeatures={importantFeatures} />
          {!validation_table && exdata && fields && (exdata.length > 0) &&
            <LegacyPredictionTable
              records={exdata}
              shaps={validation_shaps}
              height={height}
              width={width}
              predicted_column={formData.prediction}
              columns={fields as any}
            />
          }
          {validation_table && (
            <PredictionTable
              records={validation_table}
              shaps={validation_shaps}
              predictors={predictors}
              height={height}
              highlights={[prediction + "_predicted", prediction + "_low", prediction + "_high"]}
              width={width}
            />
          )}
        </Tab>
        {debiasing_charts && debiasing_charts.length > 0 && (
          <Tab eventKey="debiasing" title="Debiasing">
            {debiasing_charts.map((groupData: any, index: number) => (
              <DebiasingChart
                groupData={groupData}
                key={index.toString()}
                width={width}
              />
            ))}
          </Tab>
        )}
        {intervention_table && (
          <Tab eventKey="counterfactual" title="Countefactual">
            <PredictionTable
              records={intervention_table}
              height={height}
              width={width}
              highlights={[
                prediction + "_predicted",
                prediction + "_predicted_low",
                prediction + "_predicted_high",
                prediction + "_intervened",
                prediction + "_intervened_low",
                prediction + "_intervened_high",
                "intervention_effect",
                "intervention_effect_low",
                "intervention_effect_high",
              ]}
            />
          </Tab>
        )}
        <Tab eventKey="table" title="Table">
          <div id="virtualized-table">
            <DynamicMultiGrid
              getContent={({ rowIndex, columnIndex }) => {
                const name = headerTable[columnIndex];
                if (rowIndex === 0) return name;
                return dataTable[name][rowIndex - 1];
              }}
              columnCount={headerTable.length}
              height={height-23}
              rowCount={countTable+1}
              width={width}
            />
          </div>
        </Tab>
      </Tabs>
    </DynamicChart>
  );
}

export default RegressionChart;
