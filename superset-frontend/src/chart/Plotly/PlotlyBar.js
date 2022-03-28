/* eslint-disable */
import React, { Component } from 'react';
import Plot from 'react-plotly.js';
import PropTypes from 'prop-types';
import { getColorScheme, getIdColor } from './Common';

const _ = require('lodash');

const propTypes = {
    annotationData: PropTypes.object,
    actions: PropTypes.object,
    chartId: PropTypes.number.isRequired,
    datasource: PropTypes.object.isRequired,
    initialValues: PropTypes.object,
    formData: PropTypes.object.isRequired,
    height: PropTypes.number,
    width: PropTypes.number,
    setControlValue: PropTypes.func,
    vizType: PropTypes.string.isRequired,
    triggerRender: PropTypes.bool,
    // state
    chartAlert: PropTypes.string,
    chartStatus: PropTypes.string,
    queryResponse: PropTypes.object,
    triggerQuery: PropTypes.bool,
    refreshOverlayVisible: PropTypes.bool,
    // dashboard callbacks
    addFilter: PropTypes.func,
    onFilterMenuOpen: PropTypes.func,
    onFilterMenuClose: PropTypes.func,
};

/**
 * Find standard deviation with pool more than 50
 * @param sample
 * @param numberOfSample
 * @returns {{proportion: *, sample: *, standardDeviation: *}}
 */
const calcCI = (sample, numberOfSample) => {
    const proportion = sample / numberOfSample;
    const standardDeviation = (1- (0.05/2))*Math.sqrt((proportion * (1 - proportion)) / numberOfSample);
    return {
        sample,
        proportion: _.round(proportion * 100, 3),
        standardDeviation: _.round(standardDeviation * 100, 3)
    }
};

class PlotlyBar extends Component {
    render() {
        // Init variables
        const {
            show_error_bars,
            color_scheme,
            show_legend,
            show_stacked,
            show_percentage,
            columns,
            horizontal_mode,
            show_bar_value,
            x_axis_label,
            y_axis_label,
        } = this.props.formData;
        const { data } = this.props.queryResponse;
        const { width, height } = this.props;
        const chart = [];
        const samples = data.chart[0];
        const chartColumns = [];
        const colorScheme = getColorScheme(color_scheme);

        const createTrace = (xArray, yArray, textArray, name, color, errorBarArray) => {
            return {
                x: xArray,
                y: yArray,
                text: show_percentage && show_error_bars ? [] : show_bar_value ? textArray : [],
                textposition: 'auto',
                type: 'bar',
                name: name,
                marker: {
                    color: color,
                },
                error_y: {
                    type: 'data',
                    visible: show_error_bars && show_percentage && !horizontal_mode,
                    array: errorBarArray,
                },
                error_x: {
                    type: 'data',
                    visible: show_error_bars && show_percentage && horizontal_mode,
                    array: errorBarArray,
                },
                orientation: horizontal_mode ? 'h' : '',
            }
        };

        // Data for chart without breakdowns
        let index = 0;
        samples.values.forEach((value) => {
            const { proportion, sample, standardDeviation } = calcCI(value.y, samples.total);
            const length = show_percentage ? proportion : sample;
            const xArray = [horizontal_mode ? length : value.x];
            const yArray = [horizontal_mode ? value.x : length];
            const textArray = show_error_bars ? [] : show_bar_value ? [show_percentage ? `${length} % ` : length] : [];
            const name = value.x;
            const color = colorScheme[getIdColor(colorScheme.length,index)];
            index++;
            const trace = createTrace(xArray, yArray, textArray, name, color, [standardDeviation]);
            chart.push(trace);
        });

        // Data chart with breakdowns
        index = 0;
        data.chart.forEach((item) => {
            let xArray = [];
            let yArray = [];
            let textArray = [];
            let errorBarArray = [];
            const name = item.key;
            item.values.forEach((value) => {
                const { proportion, sample, standardDeviation } = calcCI(value.y, item.total);
                const length = show_percentage ? proportion : sample;
                xArray.push(horizontal_mode ? length : value.x);
                yArray.push(horizontal_mode ? value.x : length);
                textArray.push(show_percentage ? `${length} %` : length);
                errorBarArray.push(standardDeviation);
            })
            const color = colorScheme[getIdColor(colorScheme.length,index)];
            const trace = createTrace(xArray, yArray, textArray, name, color, errorBarArray);
            chartColumns.push(trace);
            index++;
        });

        return (
            <>
                <Plot
                    data={columns.length === 0 ? chart : chartColumns}
                    layout={{
                        width,
                        autosize: true,
                        height: horizontal_mode ? height - 10 : height - 100,
                        showlegend: show_legend,
                        hovermode: 'closest',
                        barmode: show_stacked ? 'stack' : '',
                        yaxis: {
                            automargin: true,
                            ticksuffix: horizontal_mode ? '' : show_percentage ? '%' : '',
                            range: horizontal_mode ? '' : show_percentage ? [0, 1] : null,
                            autorange: true,
                            fixedrange: show_percentage && !horizontal_mode,
                            title: {
                                text: y_axis_label ? y_axis_label : '',
                            },
                        },
                        xaxis: {
                            automargin: true,
                            ticksuffix: !horizontal_mode ? '' : show_percentage ? '%' : '',
                            fixedrange: show_percentage && horizontal_mode,
                            title: {
                                text: x_axis_label ? x_axis_label : '',
                            },
                        },
                    }}
                />
            </>
        );
    }
}

PlotlyBar.propTypes = propTypes;

export default PlotlyBar;
