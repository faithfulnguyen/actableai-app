import React, { Component } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { MultiGrid } from 'react-virtualized';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import axios from 'axios';
import TooltipWrapper from 'src/components/TooltipWrapper';
import BaseChart from '../BaseChart';

import d3 from 'd3';
import PropTypes from 'prop-types';
import cloudLayout from 'd3-cloud';
import { SequentialScheme, getSequentialSchemeRegistry  } from '@superset-ui/color';
const ROTATION = {
  square: () => Math.floor(Math.random() * 2) * 90,
  flat: () => 0,
  random: () => Math.floor(Math.random() * 6 - 3) * 30
};
const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    size: PropTypes.number,
    text: PropTypes.string
  })),
  width: PropTypes.number,
  height: PropTypes.number,
  rotation: PropTypes.string,
  sizeRange: PropTypes.arrayOf(PropTypes.number),
  colorScheme: PropTypes.string
};

function WordCloud(element, props) {
  const {
    data,
    width,
    height,
    rotation,
    sizeRange,
    colorScheme
  } = props;
  const chart = d3.select(element);
  chart.classed('superset-legacy-chart-word-cloud', true);
  const size = [width, height];
  const rotationFn = ROTATION[rotation] || ROTATION.flat;
  const scale = d3.scale.linear().range(sizeRange).domain(d3.extent(data, d => d.size));
  const layout = cloudLayout().size(size).words(data).padding(5).rotate(rotationFn).font('Helvetica').fontWeight('bold').fontSize(d => scale(d.size));
  const colorFn = getSequentialSchemeRegistry().get(colorScheme).createLinearScale();

  function draw(words) {
    chart.selectAll('*').remove();
    const [w, h] = layout.size();
    chart.append('svg').attr('width', w).attr('height', h).append('g').attr('transform', "translate(" + w / 2 + "," + h / 2 + ")").selectAll('text').data(words).enter().append('text').style('font-size', d => d.size + "px").style('font-weight', 'bold').style('font-family', 'Helvetica').style('fill', d => colorFn(d.color)).attr('text-anchor', 'middle').attr('transform', d => "translate(" + d.x + ", " + d.y + ") rotate(" + d.rotate + ")").text(d => d.text);
  }

  layout.on('end', draw).start();
}

WordCloud.displayName = 'WordCloud';
WordCloud.propTypes = propTypes;

class Sentiment extends BaseChart {

  constructor(props) {
    super(props);
    this.ref = React.createRef();
    this._cellTable = this._cellTable.bind(this);
    this._cellContext = this._cellContext.bind(this);
  }

  taskUrl(taskId) {
    return `/sentiment/api/task/${taskId}`;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if ((this.state.taskStatus !== "SUCCESS"))  {
      return;
    }

    const { width, height, queryResponse, formData } = this.props;
    const { taskId, min_freq } = formData;
    const { data } =  this.state.chartData;

    var kw = new Map();
    for (var i = 0; i < data.length; i++) {
      let k = data[i].keyword;
      if (!(k in kw)) {
        kw[k] = {
          "positive": 0,
          "negative": 0,
          "neutral": 0,
          "mention": 0,
        }
      }
      kw[k][data[i].sentiment] += 1;
      kw[k]["mention"] += 1;
    }

    var wc_data = [];
    for (let k in kw) {
      if (kw[k]["mention"] >= min_freq) {
        wc_data.push({
          "text": k,
          "size": kw[k]["mention"],
          "color": ((kw[k]["positive"] - kw[k]["negative"])/kw[k]["mention"] + 1)/2
        });
      }
    }

    WordCloud(this.ref.current, {
      data: wc_data,
      width: width,
      height: height,
      sizeRange: [formData.size_from, formData.size_to],
      colorScheme: formData.linear_color_scheme,
      rotation: formData.rotation,
    });
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
      const text = this.dataTable[name][rowIndex - 1];
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  _cellContext({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const name = ["row", "keyword", "sentence", "sentiment"][columnIndex];

    if (rowIndex === 0) {
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={name}>
            <span>{name}</span>
          </TooltipWrapper>
        </div>
      );
    }else {
      const text = this.state.chartData.data[rowIndex - 1][name];
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  renderCharts() {
    // get data table
    const { width, height, queryResponse, formData } = this.props;
    if (!this.state.isPolling) {
      this.dataTable = this.state.chartData.table;
      this.headerTable = Object.keys(this.dataTable);
      this.countTable = 0;
      if(this.headerTable.length > 0){
        this.countTable = Object.keys(this.dataTable[this.headerTable[0]]).length;
      }
    }

    return !this.state.isPolling ? (
        <Tabs defaultActiveKey="word-cloud" id="tab-content">
          <Tab eventKey="word-cloud" title="Word Cloud">
            <div id="word-cloud" ref={this.ref}></div>
          </Tab>
          <Tab eventKey="mentions" title="Context">
            <div id="virtualized-table">
              <MultiGrid
                columnCount={4}
                columnWidth={120}
                fixedColumnCount={0}
                fixedRowCount={1}
                height={height-23}
                cellRenderer={this._cellContext}
                rowCount={this.state.chartData.data.length}
                rowHeight={48}
                width={width}
                styleBottomRightGrid={{outline: `none`}}
              />
            </div>
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
                rowCount={this.countTable+1}
                rowHeight={48}
                width={width}
                styleBottomRightGrid={{outline: `none`}}
              />
            </div>
          </Tab>
        </Tabs>
      ) : (
        <div/>
      );
  }
}

export default Sentiment;
