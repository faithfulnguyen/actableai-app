import React from 'react';
import { List, ListRowRenderer } from 'react-virtualized';
import Select from './Select';
import { StateManagerProps } from 'react-select-5/dist/declarations/src/useStateManager';

const MenuList = (props: any) => {
  const { width } = props.selectProps;
  const rows = props.children;
  const rowRenderer: ListRowRenderer = ({
    key, index, style,
  }) => (
    <div key={key} style={style}>{rows[index]}</div>
  );

  return (
    <List
      width={width}
      height={Math.min(45 * (rows.length || 0), 315)}
      rowHeight={45}
      rowCount={rows.length || 0}
      rowRenderer={rowRenderer}
      style={{width: 'unset'}}
    />
  );
};

const VirtualSelect = React.forwardRef<any, any>((props: StateManagerProps<any, any, any>, ref) => {
  return (
    <Select {...props} components={{ MenuList }} ref={ref} />
  )
})

export default VirtualSelect
