import React, { Component } from 'react';
import Plot from 'react-plotly.js';
import { formatNumber, getColorScheme, getMedian, roundLowValue, roundUpValue } from './Common';

class PlotlyBubble extends Component {
    render() {
        const {
            width,
            height,
            annotationData,
            datasource,
            initialValues,
            formData,
            queryResponse,
        } = this.props;
        const {
            // Query
            timeline,
            group,
            max_bubble_size,
            duration,
            // Customize
            color_scheme,
            show_legend,
            x_axis_label,
            left_margin,
            x_axis_format,
            x_ticks_layout,
            x_log_scalefalsetrue,
            x_axis_showminmax,
            y_axis_label,
            bottom_margin,
            y_axis_format,
            y_ticks_layout,
            y_log_scalefalsetrue,
            y_axis_showminmax,
        } = formData;
        const max_size = 3 * (max_bubble_size == null ? 50 : max_bubble_size);
        const dataRespon = _.sortBy(queryResponse.data, x => x.key);
        //
        const trace = [];
        const step = [];
        const frames = [];
         // All array value from
        let valueArray = dataRespon.map(value =>
            value.values.map(child => Object.assign({ key: value.key }, child))
        ).reduce((l, n) => l.concat(n), []);
        // Get min & max value
        const arrayX = valueArray.map(x => x.x);
        const arrayY = valueArray.map(x => x.y);
        const minValueX = Math.min(...arrayX);
        const minValueY = Math.min(...arrayY);
        const maxValueX = Math.max(...arrayX);
        const maxValueY = Math.max(...arrayY);
        const minX = roundLowValue(minValueX, maxValueX);
        const minY = roundLowValue(minValueY, maxValueY);
        const maxX = roundUpValue(maxValueX);
        const maxY = roundUpValue(maxValueY);
        const maxSizeValue = Math.max(...valueArray.map(x => x.size));
        // get size reference
        const sizeref = 2.0 * maxSizeValue / (max_size ** 2);
        const sizeLegend = maxSizeValue < 100 ? 100 : maxSizeValue;
        //
        const color = getColorScheme(color_scheme);
        const seriesName = group === null ? "undefined" : group;
        const groupBy = key => array =>
            array.reduce(
                (objectsByKeyValue, obj) => ({
                    ...objectsByKeyValue,
                    [obj[key]]: (objectsByKeyValue[obj[key]] || []).concat(obj),
                }),
                {},
            );
        const groupBySeries = groupBy(seriesName);
        let group_by = valueArray.map(row => row[group]);
        group_by = group_by.filter(function(item, pos){
          return group_by.indexOf(item)== pos; 
        });
        const groupLegend = group_by;
        let uid = 0;
        for (let i = 0; i < dataRespon.length; i++) {
            // eslint-disable-next-line max-len
            dataRespon[i].values = (dataRespon[i].values).sort((a, b) => (a[seriesName] < b[seriesName]) ? -1 : (a[seriesName] > b[seriesName] ? 1 : 0));
            const rows = dataRespon[i].values;
            const keys = dataRespon[i].key;
            const newgroup = groupBySeries(rows);
            const firstItem = i === 0 ? true : false;
            //
            const dataFrame = [];
            const valueX = [];
            const valueY = [];
            for (const index in groupLegend) {
                const name = groupLegend[index];
                const cX = [];
                const cY = [];
                const cSize = [];
                const cText = [];
                const values = newgroup[name] === undefined ? [{x:0,y:0,size:0}] : newgroup[name];
                let displayName = name;
                if (name === undefined || name === null) { displayName = ""; }
                values.forEach((item) => {
                    // Push value
                    const itemX = item.x==null?0:item.x;
                    const itemY = item.y==null?0:item.y;
                    const itemSize = item.size==null?0:item.size;
                    valueX.push(itemX);
                    valueY.push(itemY);
                    cX.push(itemX);
                    cY.push(itemY);
                    cSize.push(itemSize);
                    let text = '<b>' + displayName;
                    text += `</b><br>${formData.x.label}   ${formatNumber(itemX,x_axis_format)}<br>${formData.y.label}   ${formatNumber(itemY,y_axis_format)}<br>${formData.size.label}   ${formatNumber(itemSize,'SMART_NUMBER')}<br>`;
                    if(item.size!==0) {cText.push(text);}
                });
                // add value to set size icon legend
                cSize.push(sizeLegend);
                // add all data
                dataFrame.push(
                    {
                        mode: 'markers',
                        name: displayName,
                        type: 'scatter',
                        marker: {
                            sizeref: sizeref,
                            size: cSize,
                            sizemode: 'area',
                        },
                        x: cX,
                        y: cY,
                        text: cText,
                        showlegend: true
                    },
                );
                // add show first data
                if (firstItem){
                    trace.push(
                        {
                            uid,
                            mode: 'markers',
                            name: displayName,
                            type: 'scatter',
                            marker: {
                                sizeref: sizeref,
                                size: cSize,
                                sizemode: 'area',
                            },
                            x: cX,
                            y: cY,
                            text: cText,
                            hoverinfo: 'text',
                        },
                    );
                    uid+=1;
                }
            }
            // Add step
            step.push(
                {
                    method: 'animate',
                    label: keys,
                    args: [
                        [keys], {
                            mode: 'immediate',
                            transition: { duration: duration },
                            frame: {
                                duration: duration,
                                redraw: false,
                            },
                        },
                    ],
                },
            );
            //
            const medianX = getMedian(valueX);
            const medianY = getMedian(valueY);
            if (firstItem){
                trace.unshift(
                    {
                        mode: "lines",
                        x: [minX,maxX],
                        y: [medianY,medianY],
                        text: [],
                        hoverinfo: 'text',
                        showlegend: false,
                        line: {
                            color: '#ddd',
                            width: 4
                        }
                    }
                );
                trace.unshift(
                    {
                        mode: "lines",
                        x: [medianX,medianX],
                        y: [minY,maxY],
                        text: [],
                        hoverinfo: 'text',
                        showlegend: false,
                        line: {
                            color: '#ddd',
                            width: 4
                        }
                    }
                );
            }
            // add median line
            dataFrame.unshift({
                        mode: "lines",
                        x: [minX,maxX],
                        y: [medianY,medianY],
                        text: [],
                        hoverinfo: 'text',
                        showlegend: false,
                        line: {
                            color: '#ddd',
                            width: 4
                        }
                    });
            dataFrame.unshift({
                        mode: "lines",
                        x: [medianX,medianX],
                        y: [minY,maxY],
                        text: [],
                        hoverinfo: 'text',
                        showlegend: false,
                        line: {
                            color: '#ddd',
                            width: 4
                        }
                    });
            frames.push(
                {
                    data: dataFrame,
                    name: keys,
                    layout: {},
                },
            );
        }
        //
        const layouts = {
            width,
            height,
            margin: {
                t: 40,
                l: left_margin,
                b: bottom_margin,
            },
            legend: {
                orientation: 'v'
            },
            showlegend: show_legend,
            hovermode: 'closest',
            xaxis: {
                title: x_axis_label === '' ? formData.x.label : x_axis_label,
                range: [minX, maxX],
                autorange: false,
            },
            yaxis: {
                title: y_axis_label === '' ? formData.y.label : y_axis_label,
                range: [minY, maxY],
                autorange: false,
            },
            sliders: [
                {
                    pad: {l: 130, t: 55},
                    currentvalue: {
                        visible: true,
                        prefix: timeline.charAt(0).toUpperCase() + timeline.slice(1) + ':',
                        xanchor: 'right',
                        font: { size: 20 },
                    },
                    steps: step,
                },
            ],
            updatemenus: [
                {
                    x: 0,
                    y: 0,
                    yanchor: 'top',
                    xanchor: 'left',
                    showactive: true,
                    direction: 'left',
                    type: 'buttons',
                    pad: {t: 87, r: 10},
                    buttons: [
                        {
                            method: 'animate',
                            args: [null, {
                                mode: 'immediate',
                                fromcurrent: true,
                                transition: {
                                    duration: duration,
                                },
                                frame: {
                                    redraw: false,
                                    duration: duration,
                                },
                            }],
                            label: 'Play',
                        },
                        {
                            method: 'animate',
                            args: [
                                [null], {
                                    mode: 'immediate',
                                    transition: { duration: 0 },
                                    frame: {
                                        redraw: false,
                                        duration: 0,
                                    },
                                },
                            ],
                            label: 'Pause',
                        },
                    ],
                },
            ],
        };
        return (
          <Plot
            data={trace}
            layout={layouts}
            frames={frames}
            config={{ displayModeBar: false }}
          />
        );
    }
}

export default PlotlyBubble;