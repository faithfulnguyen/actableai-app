import React from 'react';
import ReactSelect from 'react-select-5';
import { StateManagerProps } from 'react-select-5/dist/declarations/src/useStateManager';

interface ISelectProps extends StateManagerProps<any, any, any> {
  inModal?: boolean;
}

const Select = React.forwardRef<any, ISelectProps>(({inModal, ...props}, ref) => {
  return (
    <ReactSelect 
      {...props}
      ref={ref}
      menuPortalTarget={inModal?document.body:undefined}
      styles={{
        ...props.styles,
        menuPortal: (provided) => ({
          ...provided,
          zIndex: inModal ? 2000 : undefined,
        })
      }}
    />
  )
})

export default Select
