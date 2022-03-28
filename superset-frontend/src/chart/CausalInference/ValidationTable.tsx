import { Data, Layout } from 'plotly.js';
import React from 'react'
import Plot from 'react-plotly.js';

type Props = {
  data: {
    model_y_scores: {
      mean: number;
      stderr: number;
      metric: string;
    };
    model_t_scores: {
      mean: number;
      stderr: number;
      metric: string;
    };
    model_t_feature_importances: {
      index: string[];
      data: {
        importance: number[];
        stderr: number[];
      }
    };
    model_y_feature_importances: {
      index: string[];
      data: {
        importance: number[];
        stderr: number[];
      }
    };
    T_res: any[];
    Y_res: any[];
  };
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function ValidationTable({ data }: Props) {
  let residuals: {
    traces: Data[];
    layout: Partial<Layout>;
    style: React.CSSProperties;
  } = {
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
          minHeight: '450px',
      }
  };

  return (
    <div id="table-performance">
        <h3>Treatment model</h3>
        <div>
          <label>
            <strong>{capitalize(data.model_t_scores.metric)}</strong>: {data.model_t_scores.mean.toFixed(3)}
            <span style={{color: "red"}}>
                &nbsp; &plusmn;{data.model_t_scores.stderr.toFixed(3)}
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
            <strong>{capitalize(data.model_y_scores.metric)}</strong>: {data.model_y_scores.mean.toFixed(3)}
            <span style={{color: "red"}}>
                &nbsp; &plusmn;{data.model_y_scores.stderr.toFixed(3)}
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
            {data.model_y_feature_importances.index.map((feature, i) => (
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

export default ValidationTable;
