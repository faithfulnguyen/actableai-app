import React, { useMemo } from 'react';
import { CellMeasurer, CellMeasurerCache, GridCellRenderer, MultiGrid } from 'react-virtualized';
import TooltipWrapper from 'src/components/TooltipWrapper';

interface ILegacyPredictionTableProps {
  columns: string[];
  records: Record<string, any>[];
  height: number;
  width: number;
  predicted_column: string;
  shaps: any;
}

function LegacyPredictionTable({ columns, records, height, width, predicted_column, shaps }: ILegacyPredictionTableProps) {
  const cache = useMemo(() => {
    return new CellMeasurerCache({
      defaultWidth: 150,
      minWidth: 120,
      fixedHeight: true,
    })
  }, [])

  const cellRenderer: GridCellRenderer = ({ columnIndex, key, parent, rowIndex, style }) => {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    if (rowIndex === 0) {
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className="header" key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={columns[columnIndex]}>
              <span>{columns[columnIndex]}</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    } else {
      let stylePredict = {};
      if (columnIndex >= columns.indexOf(predicted_column)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
      }
      let text = records[rowIndex - 1][columns[columnIndex]] !== undefined ? records[rowIndex - 1][columns[columnIndex]] : '';
      if(Number(text)){
        text = Number(text).toFixed(3);
      }
      const shap = (rowIndex - 1 < shaps.length && columnIndex < shaps[rowIndex - 1].length)
      ? shaps[rowIndex - 1][columnIndex]
      : false;
      
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className={className} key={key} style={style}>
            <TooltipWrapper label="cell" tooltip={text}>
              <span style={stylePredict}>
                {text}
                {shap && shap > 0 &&
                    <span style={{color: "blue"}}>
                        &nbsp;(+{shap.toFixed(2)})
                    </span>
                }
                {shap && shap < 0 &&
                    <span style={{color: "red"}}>
                        &nbsp;({shap.toFixed(2)})
                    </span>
                }</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    }
  }


  return (
    <div id="virtualized-table" style={{ float: "left", marginTop: "50px"}}>
      <MultiGrid
        columnCount={columns.length}
        columnWidth={120}
        fixedColumnCount={0}
        fixedRowCount={1}
        height={height-23}
        cellRenderer={cellRenderer}
        rowCount={records.length+1}
        rowHeight={48}
        width={width}
        styleBottomRightGrid={{outline: `none`}}
      />
    </div>
  );
}

export default LegacyPredictionTable;
