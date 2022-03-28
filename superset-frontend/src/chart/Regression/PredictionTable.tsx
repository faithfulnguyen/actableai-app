import React, { useMemo } from 'react';
import { CellMeasurer, CellMeasurerCache, GridCellRenderer, MultiGrid } from 'react-virtualized';
import TooltipWrapper from 'src/components/TooltipWrapper';

interface IPredictionTableProps {
  records: {
    columns: string[];
    data: Record<string, any[]>;
  };
  height: number;
  width: number;
  shaps?: string[];
  highlights: string[];
  predictors?: string[];
}

function PredictionTable({ records, height, width, shaps, highlights, predictors }: IPredictionTableProps) {
  const cache = useMemo(() => {
    return new CellMeasurerCache({
      defaultWidth: 150,
      minWidth: 120,
      fixedHeight: true,
    })
  }, [])
  
  const cellRenderer: GridCellRenderer = ({ columnIndex, key, parent, rowIndex, style }) => {
    const className = rowIndex % 2 === 0 ? 'cell even' : 'cell odd';
    const column = records.columns[columnIndex];
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
            <TooltipWrapper label="cell" tooltip={column}>
              <span>{column}</span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    } else {
      let stylePredict = {};
      if (highlights.includes(column)) {
        stylePredict = {
          color: 'red',
          fontWeight: 'bold',
        };
      }
      let shap: any = false;
      if (predictors && shaps) {
        const predictor_id = predictors.indexOf(column);
        shap =
          ((predictor_id >= 0 &&
          rowIndex - 1 < shaps.length &&
          predictor_id < shaps[rowIndex - 1].length)?
            shaps[rowIndex - 1][predictor_id]:false);
      }

      let text = records.data[column][rowIndex - 1];
      if(Number(text)){
        text = parseFloat(Number(text).toFixed(3));
      }
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
                {shap && shap > 0 && (
                  <span style={{ color: "blue" }}>
                    &nbsp;(+{shap.toFixed(2)})
                  </span>
                )}
                {shap && shap < 0 && (
                  <span style={{ color: "red" }}>
                    &nbsp;({shap.toFixed(2)})
                  </span>
                )}
              </span>
            </TooltipWrapper>
          </div>
        </CellMeasurer>
      );
    }
  }

  return (
    <div id="virtualized-table" style={{ float: "left", marginTop: "50px"}}>
      <MultiGrid
        columnCount={records["columns"].length}
        columnWidth={cache.columnWidth}
        fixedColumnCount={0}
        fixedRowCount={1}
        height={height-23}
        cellRenderer={cellRenderer}
        rowCount={records["data"][records["columns"][0]].length+1}
        rowHeight={48}
        width={width}
        styleBottomRightGrid={{ outline: `none` }}
      />
    </div>
  );
}

export default PredictionTable;
