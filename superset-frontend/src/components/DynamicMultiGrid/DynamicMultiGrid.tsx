import React, { useMemo } from 'react';
import { CellMeasurer, CellMeasurerCache, GridCellProps, MultiGrid } from 'react-virtualized';
import Highlighter from '../Highlighter';
import ScrollOnHover from '../ScrollOnHover';
import TooltipWrapper from '../TooltipWrapper';
import Highlight from './Highlight';

interface ICellProps {
  rowIndex: number;
  columnIndex: number;
}

interface IDynamicMultiGridProps {
  getCellStyle?: (props: ICellProps) => React.CSSProperties | undefined;
  getClassName?: (props: ICellProps) => any;
  getContent: (props: ICellProps) => any;
  width: number;
  height: number;
  rowCount: number;
  columnCount: number;
  highlight?: RegExp;
  doNotVirtualize?: boolean;
  fixedColumnCount?: number;
}

function DynamicMultiGrid({ 
  getCellStyle = () => undefined,
  getClassName = ({ rowIndex }) => (rowIndex === 0 && 'header') || (rowIndex % 2 === 0 ? "cell even" : "cell odd"),
  getContent, width, height, rowCount, columnCount, highlight, doNotVirtualize, fixedColumnCount = 0,
}: IDynamicMultiGridProps) {
  const cache = useMemo(() => new CellMeasurerCache({
    defaultWidth: 150,
    minWidth: 120,
    fixedHeight: true,
  }), []);

  const cellRenderer = ({ columnIndex = 0, key, parent, rowIndex = 0, style }: Partial<GridCellProps>) => {
    const className = doNotVirtualize ? '' : getClassName({ rowIndex, columnIndex });
    let content = getContent({ rowIndex, columnIndex });

    const numberContent = Number(content);
    if (numberContent) {
      content = parseFloat(numberContent.toFixed(3));
    }

    let cell = highlight
      ? <Highlighter text={content} highlight={highlight} HighlightComponent={Highlight} />
      : content;
      
    if (!doNotVirtualize) {
      cell = (
        <ScrollOnHover>
          {cell}
        </ScrollOnHover>
      );
    }
    
    if (!!content || content === 0) {
      cell = (      
        <TooltipWrapper
          label="cell"
          tooltip={content}
        >
          {cell}
        </TooltipWrapper>
      );
    }

    cell = (
      <div key={key} className={className} style={{...style, ...(getCellStyle({ rowIndex, columnIndex}) || {})}}>
        {cell}
      </div>
    )

    if (rowIndex === 0 && parent) {
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          {cell}
        </CellMeasurer>
      );
    }

    return cell;
  }

  if (doNotVirtualize) {
    const rows: any[][] = [];
    for(let rowIndex = 0; rowIndex < rowCount; rowIndex++){
      rows[rowIndex] = [];
      for(let columnIndex = 0; columnIndex < columnCount; columnIndex++){
        rows[rowIndex][columnIndex] = cellRenderer({
          columnIndex,
          key: `${rowIndex}:${columnIndex}`,
          rowIndex,
          style: {},
        });
      }
    }
    return (
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex.toString()}>
              {row.map((column, columnIndex) => rowIndex === 0
                ? <th key={columnIndex.toString()}>{column}</th>
                : <td key={columnIndex.toString()}>{column}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <MultiGrid
      columnCount={columnCount}
      columnWidth={cache.columnWidth}
      fixedColumnCount={fixedColumnCount}
      fixedRowCount={1}
      height={height}
      cellRenderer={cellRenderer}
      rowCount={rowCount}
      rowHeight={48}
      width={width}
      styleBottomRightGrid={{outline: `none`}}
    />
  );
}

export default DynamicMultiGrid