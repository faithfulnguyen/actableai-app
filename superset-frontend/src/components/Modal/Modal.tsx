import React from 'react'
import ReactModal from 'react-modal';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    padding: 0,
    background: 'white',
    border: 'none',
    boxShadow: '1px 2px 4px 0 rgba(0,0,0,.25)',
  }, overlay: {
    zIndex: 50,
  },
};

function Modal(props: ReactModal.Props) {
  return (
    <ReactModal {...props} style={customStyles}/>
  )
}

export default Modal