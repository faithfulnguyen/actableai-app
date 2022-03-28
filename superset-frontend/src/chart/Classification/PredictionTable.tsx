import React from 'react';
import DynamicMultiGrid from 'src/components/DynamicMultiGrid/DynamicMultiGrid';

interface IPredictionTableProps {
  records: {
    columns: string[];
    data: Record<string, any[]>;
  };
  height: number;
  width: number;
}

function PredictionTable({ records, width, height }: IPredictionTableProps) {
  const normalColumns: string[] = [];
  const predictedColumn: string[] = [];
  const probabilityColumns: string[] = [];

  records.columns.forEach(columnName => {
    if (columnName.includes(' probability')) {
      probabilityColumns.push(columnName)
      return;
    }
    if (columnName.includes('_predicted')) {
      predictedColumn.push(columnName)
      return;
    }
    normalColumns.push(columnName);
  });

  const sortedColumns = [...normalColumns, ...predictedColumn, ...probabilityColumns];
  const highlightColumns = [...predictedColumn,...probabilityColumns];

  return (
    <div id="virtualized-table" style={{ float: "left", marginTop :"50px"}}>
      <DynamicMultiGrid
        getCellStyle={({ columnIndex }) => {
          return highlightColumns.indexOf(sortedColumns[columnIndex]) !== -1 ? {
            color: 'red',
            fontWeight: 'bold'
          } : {};
        }}
        getContent={({ rowIndex, columnIndex }) => {
          const columnName = sortedColumns[columnIndex]
          if(rowIndex === 0) return columnName;
          return records.data[columnName][rowIndex - 1];
        }}
        columnCount={sortedColumns.length}
        height={height}
        width={width}
        rowCount={records.data[sortedColumns[0]].length + 1}
      />
    </div>
  );
}

export default PredictionTable;
