import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useTable } from 'react-table';
import Plot from 'react-plotly.js';
import Loading from 'src/components/Loading';
import Color from 'color';
import BaseChart from '../BaseChart';
import { MultiGrid } from 'react-virtualized';
import TooltipWrapper from 'src/components/TooltipWrapper';
import { getColorScheme, getIdColor } from './Common';
import MultiYAxisPlot from 'src/components/MultiYAxisPlot';

let _columns = [];
let _records = [];
let headerTable = [];
let dataTable = {};

function RenderPerformance(props) {
    const data = ['MAPE', 'MASE', 'MSE', 'sMAPE'].map((item, i) => {
        return { ...props.data.item_metrics[item], metric: item };
    });

    let columns = _.keysIn(props.data.item_metrics.MAPE).map((item, i) => {
        return {
            Header: item,
            accessor: item,
        };
    });
    columns = [{ Header: 'Metric', accessor: 'metric' }, ...columns];

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data });

    return (
        <table {...getTableProps()} style={{ border: 'solid 1px blue' }}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th
                                {...column.getHeaderProps()}
                                style={{
                                    borderBottom: 'solid 3px red',
                                    background: 'aliceblue',
                                    color: 'black',
                                    fontWeight: 'bold',
                                }}
                            >
                                {column.render('Header')}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map(row => {
                    prepareRow(row);
                    return (
                        <tr {...row.getRowProps()}>
                            {row.cells.map(cell => {
                                return (
                                    <td
                                        {...cell.getCellProps()}
                                        style={{
                                            padding: '10px',
                                            border: 'solid 1px gray',
                                            background: 'papayawhip',
                                        }}
                                    >
                                        {cell.render('Cell')}
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

class PlotlyPrediction extends BaseChart {
    constructor(props) {
        super(props);
    }

    taskUrl(taskId) {
        return `/timeseries/api/task/${taskId}`;
    }

    get chartLayouts() {
        const { width, height, formData, queryResponse } = this.props;
        const {
            date_time,
            show_legend,
            x_axis_label,
            left_margin,
            y_axis_label,
            bottom_margin,
        } = formData;

        const layoutAxis = {
            width,
            height,
            margin: {
                t: 40,
                l: left_margin,
                b: bottom_margin,
            },
            showlegend: show_legend,
        };

        const layoutChart = {
            width,
            height,
            margin: {
                t: 40,
                l: left_margin,
                b: bottom_margin,
            },
            showlegend: show_legend,
            xaxis: {
                automargin: true,
                title: x_axis_label === '' ? formData.date_time : x_axis_label,
            },
            yaxis: {
                automargin: true,
                title: y_axis_label === '' ? formData.prediction : y_axis_label,
            },
        };
        return { layoutChart, layoutAxis };
    }

    getDataChart(data, evaluate, color) {
        const evaluateData = _.cloneDeep(evaluate);
        const { layoutAxis, layoutChart } = this.chartLayouts;

        _columns = ['Date'];
        _records = [];
        let index = 0;
        const chart = [];
        const chartAxis = [];
        const chartPerformance = [];

        data.forEach(row => {
            if (!Array.isArray(row)) {
                // to make it backward-compatible
                row = [row];
            }
            row.forEach((item, itemIndex) => {
                const dataDate = item.value.data.date.concat(
                    item.value.prediction.date,
                );
                const dataValue = item.value.data.value;
                const predictionMin = item.value.prediction.min;
                const predictionMedian = item.value.prediction.median;
                const predictionMax = item.value.prediction.max;
                const sizeValue =
                    dataValue === undefined ? 0 : dataValue.length;
                const detection =
                    item.value.detection === undefined
                        ? []
                        : item.value.detection;

                const minY = _.min(dataValue.concat(predictionMin));
                const maxY = _.max(dataValue.concat(predictionMax));
                for (let i = 0; i < detection.length; i++) {
                    const line = detection[i];
                    chart.push({
                        mode: 'lines',
                        x: [line.x, line.x],
                        y: [minY, maxY],
                        line: { color: 'red' },
                        legendgroup: item.name,
                        showlegend: false,
                        //hoverinfo: "none"
                    });
                }

                // data chart
                let dataMin = [...predictionMin];
                let dataMedian = [...predictionMedian];
                let dataMax = [...predictionMax];
                for (let i = sizeValue; i > 0; i--) {
                    if (i === sizeValue) {
                        dataMin.unshift(dataValue[i - 1]);
                        dataMedian.unshift(dataValue[i - 1]);
                        dataMax.unshift(dataValue[i - 1]);
                    } else {
                        dataMin.unshift('');
                        dataMedian.unshift('');
                        dataMax.unshift('');
                    }
                }
                // set data chart
                const colorChart =
                    color[getIdColor(color.length, itemIndex)];
                const colorFill = Color(colorChart)
                    .alpha(0.2)
                    .string();
                const traceData = {
                    mode: 'lines',
                    name: item.name,
                    x: dataDate,
                    y: dataValue,
                    line: { color: colorChart },
                    legendgroup: item.name,
                };

                const traceMin = {
                    mode: 'lines',
                    name: 'Low ' + item.name,
                    fill: 'toneytx',
                    fillcolor: colorFill,
                    x: dataDate,
                    y: dataMin,
                    line: { color: colorFill },
                    legendgroup: item.name,
                    showlegend: false,
                };
                const traceMedian = {
                    mode: 'lines',
                    name: 'Median ' + item.name,
                    fill: 'tonexty',
                    fillcolor: colorFill,
                    x: dataDate,
                    y: dataMedian,
                    line: {
                        color: Color(colorChart)
                            .alpha(0.5)
                            .string(),
                    },
                    legendgroup: item.name,
                    showlegend: false,
                };
                const traceMax = {
                    mode: 'lines',
                    name: 'High ' + item.name,
                    fill: 'tonexty',
                    fillcolor: colorFill,
                    x: dataDate,
                    y: dataMax,
                    line: { color: colorFill },
                    legendgroup: item.name,
                    showlegend: false,
                };
                chart.push(traceData);
                chart.push(traceMin);
                chart.push(traceMedian);
                chart.push(traceMax);

                // multi y axis
                let yData = { ...traceData };
                let yMin = { ...traceMin };
                let yMedian = { ...traceMedian };
                let yMax = { ...traceMax };
                let dataName = 'y';
                let layoutname = 'yaxis';
                if (itemIndex > 0) {
                    dataName = 'y' + (itemIndex + 1);
                    layoutname = 'yaxis' + (itemIndex + 1);
                    yData.yaxis = dataName;
                    yMin.yaxis = dataName;
                    yMedian.yaxis = dataName;
                    yMax.yaxis = dataName;
                }

                chartAxis.push(yData);
                chartAxis.push(yMin);
                chartAxis.push(yMedian);
                chartAxis.push(yMax);

                // Performance chart
                const evaluateDate = evaluateData.dates
                    ? [...evaluateData.dates]
                    : [];
                const evaluateValues =
                    evaluateData.values && evaluateData.values[0];
                const evaluateQ5 = evaluateValues
                    ? evaluateValues[itemIndex].q5
                    : [];
                const evaluateQ50 = evaluateValues
                    ? evaluateValues[itemIndex].q50
                    : [];
                const evaluateQ95 = evaluateValues
                    ? evaluateValues[itemIndex].q95
                    : [];
                if (evaluateValues) {
                    const startIndex = dataValue.length - evaluateQ5.length - 1;
                    evaluateDate.unshift(dataDate[startIndex]);

                    const startValue = dataValue[startIndex];
                    evaluateQ5.unshift(startValue);
                    evaluateQ50.unshift(startValue);
                    evaluateQ95.unshift(startValue);
                }

                const evaluateQ5Chart = {
                    mode: 'lines',
                    name: 'Q5 ' + item.name,
                    fill: 'toneytx',
                    fillcolor: colorFill,
                    x: evaluateDate,
                    y: evaluateQ5,
                    line: {
                        color: Color(colorFill)
                            .alpha(0)
                            .string(),
                    },
                    legendgroup: item.name,
                    showlegend: false,
                };

                const evaluateQ50Chart = {
                    mode: 'lines',
                    name: 'Forecast ' + item.name,
                    fill: 'tonexty',
                    fillcolor: colorFill,
                    x: evaluateDate,
                    y: evaluateQ50,
                    line: {
                        color: Color(colorChart)
                            .alpha(0.5)
                            .string(),
                        dash: 'dash',
                    },
                    legendgroup: item.name,
                    showlegend: true,
                };

                const evaluateQ95Chart = {
                    mode: 'lines',
                    name: 'Q95 ' + item.name,
                    fill: 'tonexty',
                    fillcolor: colorFill,
                    x: evaluateDate,
                    y: evaluateQ95,
                    line: {
                        color: Color(colorFill)
                            .alpha(0)
                            .string(),
                    },
                    legendgroup: item.name,
                    showlegend: false,
                };
                chartPerformance.push(traceData);
                chartPerformance.push(evaluateQ5Chart);
                chartPerformance.push(evaluateQ50Chart);
                chartPerformance.push(evaluateQ95Chart);

                // table data
                let i = 0;
                _columns = _columns.concat([item.name, "min_"+item.name, "median_"+item.name, "max_"+item.name])
                for(i=0; i<item.value.data.date.length; i++){
                    if(_records[i] === undefined){
                        _records.push([item.value.data.date[i], item.value.data.value[i], "", "", ""]);
                    }else{
                        _records[i] = _records[i].concat([item.value.data.value[i], "", "", ""]);
                    }
                }
                for(let k=0; k<item.value.prediction.date.length; k++){
                    if(_records[i+k] === undefined){
                        _records.push([item.value.prediction.date[k], "", item.value.prediction.min[k], item.value.prediction.median[k], item.value.prediction.max[k]]);
                    }else{
                        _records[i+k] = _records[i+k].concat(["", item.value.prediction.min[k], item.value.prediction.median[k], item.value.prediction.max[k]]);
                    }
                }

                index++;
            });
        });

        // layout multi y axis
        layoutAxis.xaxis = { domain: [(index - 1) * 0.08, 1] };
        for (let i = 1; i <= index; i++) {
            let layoutname = 'yaxis';
            let layoutData = {
                title: { text: data[0][i - 1].name, standoff: 0 },
            };
            layoutData.side = 'left';
            layoutData.position = (i - 1) * 0.08;
            const colorFont = color[getIdColor(color.length, i - 1)];
            layoutData.titlefont = { color: colorFont };
            layoutData.tickfont = { color: colorFont };
            layoutData.automargin = true;
            if (i > 1) {
                layoutname = 'yaxis' + i;
                layoutData.overlaying = 'y';
                layoutData.showgrid = false;
                layoutData.anchor = 'free'
            }
            layoutAxis[layoutname] = layoutData;
        }

        return { layoutAxis, layoutChart, chart, chartAxis, chartPerformance };
    }

    _cellRenderer({columnIndex, key, parent, rowIndex, style}) {
        const className = rowIndex%2===0?"cell even":"cell odd";
         if(rowIndex === 0){
          return (
            <div className="header" key={key} style={style}>
                <TooltipWrapper
                    tooltip={_columns[columnIndex]}
                >
                    <span>{_columns[columnIndex]}</span>
                </TooltipWrapper>
            </div>
          );
        }else{
          const text = _records[rowIndex-1][columnIndex];
          return (
            <div className={className} key={key} style={style}>
                <TooltipWrapper
                    label="cell"
                    tooltip={text}
                >
                  <span>{text}</span>
                </TooltipWrapper>
            </div>
          );
        }
    };

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
    };

    

    renderCharts() {
        const { formData, width, height } = this.props;
        const colorScheme = formData.color_scheme;

        const {
            layoutAxis,
            layoutChart,
            chart,
            chartAxis,
            chartPerformance,
        } = this.getDataChart(
            this.state.chartData.data.predict,
            this.state.chartData.data.evaluate,
            getColorScheme(colorScheme),
        );
        // get data table
        dataTable = this.state.chartData.table;
        headerTable = Object.keys(dataTable);
        let countTable = 0;
        if(headerTable.length > 0){
        countTable = Object.keys(dataTable[headerTable[0]]).length;
        }
        // return tab chart && table
        return !this.state.isPolling ? (
            <Tabs defaultActiveKey="chart" id="tab-content">
                <Tab eventKey="chart" title="Multi lines chart">
                    <Plot data={chart} layout={layoutChart} />
                </Tab>
                <Tab eventKey="axis" title="Multi y axis">
                    <MultiYAxisPlot data={chartAxis} layout={layoutAxis} width={width} />
                </Tab>
                <Tab eventKey="performance" title="Performance">
                    <RenderPerformance data={this.state.chartData.data.evaluate} />
                    <Plot data={chartPerformance} layout={layoutChart} />
                </Tab>
                <Tab eventKey="table-lines" title="Table lines chart">
                    <div id="virtualized-table">
                        <MultiGrid
                        columnCount={_columns.length}
                        columnWidth={120}
                        fixedColumnCount={0}
                        fixedRowCount={1}
                        height={height-23}
                        cellRenderer={this._cellRenderer}
                        rowCount={_records.length+1}
                        rowHeight={48}
                        width={width}
                        styleBottomRightGrid={{outline: `none`}}
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
                            height={height-23}
                            cellRenderer={this._cellTable}
                            rowCount={countTable+1}
                            rowHeight={48}
                            width={width}
                            styleBottomRightGrid={{outline: `none`}}
                        />
                    </div>
                </Tab>
            </Tabs>
        ) : (
            <Loading size={50} />
        );
    }
}

export default PlotlyPrediction;
