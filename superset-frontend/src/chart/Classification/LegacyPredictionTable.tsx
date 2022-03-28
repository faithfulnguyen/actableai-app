import React from 'react';
import { GridCellRenderer, MultiGrid } from 'react-virtualized';
import TooltipWrapper from 'src/components/TooltipWrapper';

interface ILegacyPredictionTableProps {
  columns: string[];
  records: Record<string, any>[];
  height: number;
  width: number;
  predicted_column: string;
}

function LegacyPredictionTable({ columns, records, height, width, predicted_column }: ILegacyPredictionTableProps) {
  const cellRender: GridCellRenderer = ({ columnIndex, key, parent, rowIndex, style }) => {
    const className = rowIndex % 2 === 0 ? "cell even" : "cell odd";

    if (rowIndex === 0) {
      const value = columns[columnIndex] === "__probability__" ? 'probability' : columns[columnIndex];
      return (
        <div className="header" key={key} style={style}>
          <TooltipWrapper label="cell" tooltip={value}>
            <span>{value}</span>
          </TooltipWrapper>
        </div>
      );
    } else {
      const isPredictedColumn = predicted_column === columns[columnIndex];
      const text = records[rowIndex-1][columns[columnIndex]];

      return (
        <div className={className} key={key} style={style}>
          <TooltipWrapper
            label="cell"
            tooltip={text}
          >
            <span
              style={isPredictedColumn ? {
                color: 'red',
                fontWeight: 'bold'
              } : {}}
            >
              {text}
            </span>
          </TooltipWrapper>
        </div>
      );
    }
  }

  return (
    <div id="virtualized-table" style={{ float: "left", marginTop: "50px" }}>
      <MultiGrid
        columnCount={columns.length}
        columnWidth={120}
        fixedColumnCount={0}
        fixedRowCount={1}
        height={height-23}
        cellRenderer={cellRender}
        rowCount={records.length + 1}
        rowHeight={48}
        width={width}
        styleBottomRightGrid={{outline: `none`}}
      />
    </div>
  );
}

export default LegacyPredictionTable;
