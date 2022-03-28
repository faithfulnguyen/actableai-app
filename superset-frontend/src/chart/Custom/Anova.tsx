import React, { useMemo, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { GridCellRenderer, MultiGrid } from "react-virtualized";
import TooltipWrapper from 'src/components/TooltipWrapper';
import Plot from 'react-plotly.js';
import { hslToHex } from 'src/utils/colors';
import { t } from '@superset-ui/translation';

interface IAnovaFormData {
  taskId: null;
  min_freq: string;
  treatment: string[];
  outcome: string;
  anovaType: 1 | 2;
}

interface IAnovaChart {
  width: number;
  height: number;
  queryResponse: {
    form_data: IAnovaFormData;
    data: any;
  };
  datasource: any;
  formData: IAnovaFormData;
}

const multiGridHeight = 450;

function AnovaChart(props: IAnovaChart) {
  const { width, height, queryResponse, formData, datasource } = props;
  const dynamicFormData = queryResponse.form_data || formData;

  const [flipBoxPlot, setFlipBoxPlot] = useState(false);
  const [baseTreatmentIndex, secondaryTreatment] = flipBoxPlot ? [1,0] : [0,1];
  
  const data = useMemo(() => queryResponse.data && ({
    anova_summary: queryResponse.data.anova_summary,
    tukey_summary1: queryResponse.data.tukey_summary[dynamicFormData.treatment[0]],
    tukey_summary2: queryResponse.data.tukey_summary[dynamicFormData.treatment[1]],
    tukey_summary_interaction: queryResponse.data.tukey_summary[dynamicFormData.treatment[0]+'_'+dynamicFormData.treatment[1]],
    bartlett_summary: queryResponse.data.bartlett_summary,
    levene_summary: queryResponse.data.levene_summary,
    shapiro_wilk_summary: [queryResponse.data.shapiro_wilk_summary],
    table: queryResponse.data.table,
  }), [queryResponse.data]);

  const headers = useMemo(() => queryResponse.data && ({
    anova_summary: Object.keys(queryResponse.data.anova_summary[0]),
    tukey_summary1: Object.keys(queryResponse.data.tukey_summary[dynamicFormData.treatment[0]][0]),
    tukey_summary2: Object.keys(queryResponse.data.tukey_summary[dynamicFormData.treatment[1]]?.[0] || {}),
    tukey_summary_interaction: Object.keys(queryResponse.data.tukey_summary[dynamicFormData.treatment[0]+'_'+dynamicFormData.treatment[1]]?.[0] || {}),
    bartlett_summary: Object.keys(queryResponse.data.bartlett_summary[0]),
    levene_summary: Object.keys(queryResponse.data.levene_summary[0]),
    shapiro_wilk_summary: Object.keys(queryResponse.data.shapiro_wilk_summary),
    table: Object.keys(data.table),
  }), [queryResponse.data]);

  const _cellTable: (dataName: string) => GridCellRenderer = (dataName) => ({ columnIndex, key, parent, rowIndex, style }) => {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const columnName = headers[dataName][columnIndex];

    if (rowIndex === 0) {
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={columnName}>
            <span>{columnName}</span>
          </TooltipWrapper>
        </div>
      );
    } else {
      let text;
      if (dataName === "table") {
        try {
          text = data.table[columnName][rowIndex - 1] ?? ''
        } catch (e) {
          text = e.message;
        }
      } else {
        text = data[dataName][rowIndex - 1][columnName] ?? '';
      }
      if(Number(text)) {
        text = Number(text).toFixed(3);
      }
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  const boxPlot = useMemo(() => {
    const result = {
      data: dynamicFormData.anovaType === 1 ? [{
        name: undefined,
        y: Object.values<number>(queryResponse.data.table[dynamicFormData.outcome]),
      }] : datasource.group_values[dynamicFormData.treatment[baseTreatmentIndex]].map((columnValue: any) => ({
        name: columnValue.value,
        y: Object.values(queryResponse.data.table[dynamicFormData.treatment[baseTreatmentIndex]])
          ?.map((value: any, index: number) => value === columnValue.value 
            ? queryResponse.data.table[dynamicFormData.outcome][index]
            : null
          )
      })),
      x: Object.values<any>(queryResponse.data.table[dynamicFormData.treatment[dynamicFormData.anovaType === 1 ? 0 : secondaryTreatment]]),
    };
    return result;
  }, [datasource, queryResponse, flipBoxPlot])

  const qqPoints = useMemo(() => {
    return {
      min: Math.min(...queryResponse.data.anova_sample_quantiles,...queryResponse.data.anova_theoretical_quantiles),
      max: Math.max(...queryResponse.data.anova_sample_quantiles,...queryResponse.data.anova_theoretical_quantiles)
    }
  }, [queryResponse.data])

  return dynamicFormData && (
    <Tabs defaultActiveKey="box-plot" id="tab-content">
      <Tab eventKey="box-plot" title="Box Plot">
        {dynamicFormData.anovaType === 2 && (
          <button className="btn float-right" onClick={() => setFlipBoxPlot(!flipBoxPlot)}>
            {t('Flip Box Plot')}
          </button>
        )}
        <Plot
          data={boxPlot.data.map((p: any, index: number) => ({
            name: p.name,
            y: p.y,
            x: boxPlot.x,
            type: 'box',
            marker: { 
              color: hslToHex((360/boxPlot.data.length + 1) * (index + 1), 100, 60),
              line: {
                outliercolor: hslToHex((360/boxPlot.data.length + 1) * (index + 1), 100, 40),
                outlierwidth: 2
              }
            },
            boxpoints: 'suspectedoutliers'
          }))}
          layout={{ title: 'Treatment Levels', boxmode: 'group', width, height }}
        />
      </Tab>
      <Tab eventKey="anova" title="ANOVA Table">
        <MultiGrid
          columnCount={headers.anova_summary.length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={multiGridHeight}
          cellRenderer={_cellTable('anova_summary')}
          rowCount={data.anova_summary.length + 1}
          rowHeight={48}
          width={width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </Tab>
      <Tab eventKey="tukeyTest" title="Tukey's Test">
        {dynamicFormData?.anovaType === 1 ? (
          <MultiGrid
            columnCount={headers.tukey_summary1.length}
            columnWidth={120}
            fixedColumnCount={0}
            fixedRowCount={1}
            height={height}
            cellRenderer={_cellTable('tukey_summary1')}
            rowCount={data.tukey_summary1.length + 1}
            rowHeight={48}
            width={width}
            styleBottomRightGrid={{outline: `none`}}
          />
        ) : (
          <Tabs defaultActiveKey={dynamicFormData.treatment[0]} id="tab-content-tukeyTest">
            <Tab eventKey={dynamicFormData.treatment[0]} title={dynamicFormData.treatment[0].charAt(0).toUpperCase() + dynamicFormData.treatment[0].slice(1)}>
              <MultiGrid
                columnCount={headers.tukey_summary1.length}
                columnWidth={120}
                fixedColumnCount={0}
                fixedRowCount={1}
                height={height - 51}
                cellRenderer={_cellTable('tukey_summary1')}
                rowCount={data.tukey_summary1.length + 1}
                rowHeight={48}
                width={width}
                styleBottomRightGrid={{outline: `none`}}
              />
            </Tab>
            <Tab eventKey={dynamicFormData.treatment[1]} title={dynamicFormData.treatment[1].charAt(0).toUpperCase() + dynamicFormData.treatment[1].slice(1)}>
              <MultiGrid
                columnCount={headers.tukey_summary2.length}
                columnWidth={120}
                fixedColumnCount={0}
                fixedRowCount={1}
                height={height - 51}
                cellRenderer={_cellTable('tukey_summary2')}
                rowCount={data.tukey_summary2.length + 1}
                rowHeight={48}
                width={width}
                styleBottomRightGrid={{outline: `none`}}
              />
            </Tab>
            {data.tukey_summary_interaction && (
              <Tab eventKey="interaction" title="Interaction">
                <MultiGrid
                  columnCount={headers.tukey_summary_interaction.length}
                  columnWidth={120}
                  fixedColumnCount={0}
                  fixedRowCount={1}
                  height={height - 51}
                  cellRenderer={_cellTable('tukey_summary_interaction')}
                  rowCount={data.tukey_summary_interaction.length + 1}
                  rowHeight={48}
                  width={width}
                  styleBottomRightGrid={{outline: `none`}}
                />
              </Tab>
            )}
          </Tabs>
        )}
      </Tab>
      <Tab eventKey="diagnostics" title="Diagnostics">
        <Tabs defaultActiveKey="qq" id="tab-content-diagnostics">
          <Tab eventKey="qq" title="Q-Q Plot">
            <Plot
              data={[
                {
                  x: queryResponse.data.anova_theoretical_quantiles,
                  y: queryResponse.data.anova_sample_quantiles,
                  type: 'scatter',
                  mode: 'markers',
                },
                {
                  x: [qqPoints.min, qqPoints.max],
                  y: [qqPoints.min, qqPoints.max],
                  type: 'scatter',
                  mode: 'lines',
                }
              ]}
              layout={{ title: 'Q-Q Plot', width, height }}
            />
          </Tab>
          <Tab eventKey="histogram" title="Residual plot">
            <Plot
              data={[
                {
                  x: queryResponse.data.anova_model_out_resid,
                  type: 'histogram',
                },
              ]}
              layout={{}}
            />
          </Tab>
          <Tab eventKey="wilk" title="Shapiro-Wilk">
            <MultiGrid
              columnCount={headers.shapiro_wilk_summary.length}
              columnWidth={177}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height - 51}
              cellRenderer={_cellTable('shapiro_wilk_summary')}
              rowCount={data.shapiro_wilk_summary.length + 1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{outline: `none`}}
            />
          </Tab>
          <Tab eventKey="barlett" title="Barlett">
            <MultiGrid
              columnCount={headers.bartlett_summary.length}
              columnWidth={177}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height - 51}
              cellRenderer={_cellTable('bartlett_summary')}
              rowCount={data.bartlett_summary.length + 1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{outline: `none`}}
            />
          </Tab>
          <Tab eventKey="levene" title="Levene">
            <MultiGrid
              columnCount={headers.levene_summary.length}
              columnWidth={177}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height - 51}
              cellRenderer={_cellTable('levene_summary')}
              rowCount={data.levene_summary.length + 1}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{outline: `none`}}
            />
          </Tab>
        </Tabs>
      </Tab>
      <Tab eventKey="table" title="Table">
        <MultiGrid
          columnCount={headers.table.length}
          columnWidth={120}
          fixedColumnCount={0}
          fixedRowCount={1}
          height={height}
          cellRenderer={_cellTable('table')}
          rowCount={Object.keys(data.table[headers.table[0]]).length}
          rowHeight={48}
          width={width}
          styleBottomRightGrid={{outline: `none`}}
        />
      </Tab>
    </Tabs>
  );
}

export default AnovaChart;
