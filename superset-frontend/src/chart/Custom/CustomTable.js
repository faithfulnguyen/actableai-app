import React, { Component } from 'react';
import { MultiGrid } from "react-virtualized";
import TooltipWrapper from 'src/components/TooltipWrapper';

class CustomTable extends Component {

  constructor(props) {
    super(props);

    this.state = {
      columns: [],
      records: [],
    }

    this._cellRenderer = this._cellRenderer.bind(this);
  }

  UNSAFE_componentWillMount() {
    const dataRespon = this.props.queryResponse.data;
    this.setState({columns: dataRespon.columns, records: dataRespon.records});
  }

  UNSAFE_componentWillUpdate(nextProps, nextState, nextContext) {
    if(nextProps !== this.props) {
      const dataRespon = nextProps.queryResponse.data;
      this.setState({columns: dataRespon.columns, records: dataRespon.records});
    }
  }

  _cellRenderer({columnIndex, key, parent, rowIndex, style}) {
    const className = rowIndex%2===0?"cell even":"cell odd";
     if(rowIndex === 0){
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={this.state.columns[columnIndex]}>
              <span>{this.state.columns[columnIndex]}</span>
          </TooltipWrapper>
        </div>
      );
    }else{
      let text = this.state.records[rowIndex-1][this.state.columns[columnIndex]];
      text = text !== null ? text.toString(): text;
      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper
            label="cell"
            tooltip={text}
          >
            <span className="text">{text}</span>
          </TooltipWrapper>
        </div>
      );
    }
  };
  render() {
    const {
      width,
      height,
    } = this.props;
    return (
    <div id="virtualized-table">
      <MultiGrid
        columnCount={this.state.columns.length}
        columnWidth={120}
        fixedColumnCount={0}
        fixedRowCount={1}
        height={height}
        cellRenderer={this._cellRenderer}
        rowCount={this.state.records.length+1}
        rowHeight={48}
        width={width}
        styleBottomRightGrid={{outline: `none`}}
      />
    </div>
    );
  }
}

export default CustomTable;