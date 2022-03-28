import React, { Component } from "react";
import { CellMeasurer, CellMeasurerCache, MultiGrid } from "react-virtualized";
import TooltipWrapper from "src/components/TooltipWrapper";

class PredictionTable extends Component {
  constructor(props) {
    super(props);
    this._cellRenderer = this._cellRenderer.bind(this);
    this._cache = new CellMeasurerCache({
      defaultWidth: 150,
      minWidth: 120,
      fixedHeight: true,
    });
  }

  _cellRenderer({ columnIndex, key, parent, rowIndex, style }) {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const column = this.props.records.columns[columnIndex];
    if (rowIndex === 0) {
      return (
        <CellMeasurer
          cache={this._cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className="header" key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={column}>
              <span>{column}</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    } else {
      let stylePredict = {};
      const predictors = this.props.formData.all_columns;
      if (columnIndex > predictors.length + ((this.props.prediction)? -1:0)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
      }

      let text = this.props.records.data[column][rowIndex - 1];
      if(Number(text)){
        text = parseFloat(Number(text).toFixed(3));
      }
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={text}>
            <span style={stylePredict}>{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  render() {
    if (!this.props.records) return <></>;

    return (
     <div id="virtualized-table" style={{ float: "left", marginTop: "50px"}}>
       <MultiGrid
         columnCount={this.props.records["columns"].length}
         columnWidth={this._cache.columnWidth}
         fixedColumnCount={0}
         fixedRowCount={1}
         height={this.props.height-23}
         cellRenderer={this._cellRenderer}
         rowCount={this.props.records["data"][this.props.records["columns"][0]].length+1}
         rowHeight={48}
         width={this.props.width}
         styleBottomRightGrid={{outline: `none`}}
       />
     </div>
    );
  }
}

export default PredictionTable;
