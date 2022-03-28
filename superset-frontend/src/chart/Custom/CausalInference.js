import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import Plot from 'react-plotly.js';
import { MultiGrid } from "react-virtualized";
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import axios from 'axios';
import TooltipWrapper from 'src/components/TooltipWrapper';
import BaseChart from '../BaseChart';
import GraphViz from 'src/components/GraphViz/GraphViz';
import CausalGraph from 'src/components/GraphViz/CausalGraph';

class CausalInference extends BaseChart {

  constructor(props) {
    super(props);
    this._cellTable = this._cellTable.bind(this);
  }

  taskUrl(taskId) {
    return `/causal_inference/api/task/${taskId}`;
  }

  _cellTable({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const name = this.headerTable[columnIndex];

    if (rowIndex === 0) {
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={name}>
            <span>{name}</span>
          </TooltipWrapper>
        </div>
      );
    }else {
      let text = this.dataTable[name][rowIndex - 1] !== undefined ? this.dataTable[name][rowIndex - 1] : '';
      if(Number(text)){
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

  ValidationTab(data) {
    let residuals = {
        traces: [
            {
               mode: 'markers',
               name: "Residuals",
               type: "scatter",
               x: data.T_res.flat(),
               y: data.Y_res.flat(),
            }
        ],
        layout: {
            xaxis: {
                title: "Treatment residuals",
            },
            yaxis: {
                title: "Outcome residuals",
            },
            autosize: true,
        },
        style: {
            width: '50vw',
            height: '40vw',
            margin: 'auto',
            minWidth: '600px',
            minHeigh: '450px',
        }
    };

    return (
      <div id="table-performance">
          <h3>Treatment model</h3>
          <div>
            <label>
              <strong>R2</strong>: {data.model_t_r2.mean.toFixed(3)}
              <span style={{color: "red"}}>
                  &nbsp; &plusmn;{data.model_t_r2.stderr.toFixed(3)}
                </span>
            </label>
          </div>
          <table id="table2">
            <thead>
              <tr>
                <th className="background">Feature</th>
                <th className="background">Importance</th>
              </tr>
            </thead>
            <tbody>
              {data.model_t_feature_importances.index.map((feature, i) => (
                <tr>
                  <td>{feature}</td>
                  <td>
                    {data.model_t_feature_importances.data.importance[i].toFixed(3)}
                    <span style={{color: "red"}}>
                      &nbsp; &plusmn;{data.model_t_feature_importances.data.stderr[i].toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Outcome model</h3>
          <div>
            <label>
              <strong>R2</strong>: {data.model_y_r2.mean.toFixed(3)}
              <span style={{color: "red"}}>
                  &nbsp; &plusmn;{data.model_y_r2.stderr.toFixed(3)}
                </span>
            </label>
          </div>
          <table id="table2">
            <thead>
              <tr>
                <th className="background">Feature</th>
                <th className="background">Importance</th>
              </tr>
            </thead>
            <tbody>
              {data.model_t_feature_importances.index.map((feature, i) => (
                <tr>
                  <td>{feature}</td>
                  <td>
                    {data.model_y_feature_importances.data.importance[i].toFixed(3)}
                    <span style={{color: "red"}}>
                      &nbsp; &plusmn;{data.model_y_feature_importances.data.stderr[i].toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Residual plot</h3>
          <Plot
            data={residuals.traces}
            layout={residuals.layout}
            style={residuals.style}
          ></Plot>
      </div>
    );
  }

  renderCharts() {
    if (this.state.isPolling) {
      return this.renderLoading();
    }

    const { width, height, queryResponse, formData } = this.props;
    const { outcome, treatment, effect_modifier } = formData;
    const { data } = this.state.chartData;
    const { effect } =  data;
    this.dataTable = this.state.chartData.table;
    this.headerTable = Object.keys(this.dataTable);
    this.rows = 0;
    if(this.headerTable.length > 0){
      this.rows = Object.keys(this.dataTable[this.headerTable[0]]).length;
    }

    const colorPalette = [
      [229, 129, 57], [200, 229, 57], [71, 229, 57], [57, 229, 172], [57, 157, 229],
      [86, 57, 229], [215, 57, 229], [229, 57, 114]
    ];

    var effectChartData, effectChartLayout;

    const treatment_effect = new Map();
    effect.map((e) => {
      let group_name = e.treatment_value? e.treatment_value:treatment;
      if (!(treatment_effect.has(group_name))) {
        treatment_effect.set(group_name, []);
      }
      treatment_effect.get(group_name).push(e);
    });

    if ((effect_modifier != null) && (typeof(effect[0][effect_modifier]) == "number")) {
      let i = 0;
      effectChartData = [];
      treatment_effect.forEach((g, treatment_value, map) => {
        const fill = "rgba(" + colorPalette[i][0] + "," + colorPalette[i][1] + "," + colorPalette[i][2] + ",0.2)";
        const color = "rgba(" + colorPalette[i][0] + "," + colorPalette[i][1] + "," + colorPalette[i][2] + ")";
        const effect_modifiers = g.map((e) => e[effect_modifier]);
        const lb = g.map((e) => e.lb);
        const ub = g.map((e) => e.ub);
        const cate = g.map((e) => e.cate);
        effectChartData.push(...[
          {
            x: effect_modifiers.concat([...effect_modifiers].reverse(), effect_modifiers[0]),
            y: lb.concat([...ub].reverse(), lb[0]),
            fillcolor: fill,
            fill: "tozerox",
            line: {color: "transparent"},
            type: "scatter",
            hoverinfo: "skip",
            showlegend: false,
          },
          {
            x: effect_modifiers,
            y: ub,
            mode: "lines",
            type: "scatter",
            line: {
              color: fill,
            },
            showlegend: false,
            name: "upper"
          },
          {
            x: effect_modifiers,
            y: lb,
            mode: "lines",
            type: "scatter",
            name: "lower",
            line: {
              color: fill,
            },
            showlegend: false,
          },
          {
            x: effect_modifiers,
            y: cate,
            line: {color: color},
            mode: "lines",
            type: "scatter",
            name: treatment_value,
          }
        ]);
        i++;
      });

      effectChartLayout = {
        width: width,
        height: height/2,
        xaxis: {
          title: effect_modifier,
          zeroline: false,
        },
        yaxis: {
          zeroline: false,
          title: "Treatment effect"
        },
      };
    }

    if ((effect_modifier == null) || (typeof(effect[0][effect_modifier]) == "string")) {
      let i = 0;
      effectChartData = [];
      treatment_effect.forEach((g, treatment_value, map) => {
        const effect_modifiers = g.map((e) => effect_modifier? e[effect_modifier]:"Treatment effect");
        const cate = g.map((e) => e.cate);
        effectChartData.push({
          x: effect_modifiers,
          y: cate,
          name: treatment_value,
          error_y: {
            type: "data",
            symmetric: false,
            array: g.map((e) => e.ub - e.cate),
            arrayminus: g.map((e) => e.cate - e.lb),
          },
          type: "bar",
        });
        i++;
      });

      effectChartLayout = {
        height: height/2,
        showlegend: true,
      };
    }

    return (
      <Tabs defaultActiveKey="treatment-effect" id="tab-content">
        <Tab eventKey="treatment-effect" title="Treatment effect">
          {(effectChartData) && <Plot data={effectChartData} layout={effectChartLayout} />}
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
        <Tab eventKey="validation" title="Validation">
            {this.ValidationTab(data)}
        </Tab>
        <Tab eventKey="table" title="Table">
          <div id="virtualized-table">
            <MultiGrid
              columnCount={this.headerTable.length}
              columnWidth={120}
              fixedColumnCount={0}
              fixedRowCount={1}
              height={height-23}
              cellRenderer={this._cellTable}
              rowCount={this.rows}
              rowHeight={48}
              width={width}
              styleBottomRightGrid={{outline: `none`}}
            />
          </div>
        </Tab>
      </Tabs>
    );
  }
}

export default CausalInference;

