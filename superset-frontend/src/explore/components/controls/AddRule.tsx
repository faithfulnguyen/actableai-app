import React, { useState } from 'react';
import ModalTrigger from '../../../components/ModalTrigger';
import EditRuleModalBody from './AddRule/EditRuleModal';
import { IRule } from './AddRule/shared';

interface IAddRuleProps {
  options: any[];
  saveData: (data: any) => void;
}

function AddRule({ options, saveData }: IAddRuleProps) {
  const [showModal, setShowModal] = useState(false)

  const onSubmit = (rule: IRule) => {
    setShowModal(false);
    saveData(rule)
  }
  
  return (
    <ModalTrigger
      showModal={showModal}
      beforeOpen={()=> setShowModal(true)}
      beforeClose={()=> setShowModal(false)}
      bsSize="large"
      modalTitle="Add new rule"
      dialogClassName={'addRule-dialog'}
      triggerNode={
        <button className="btn btn-primary">
          Add rule
        </button>
      }
      modalBody={
        <EditRuleModalBody onSubmit={onSubmit} options={options}/>
      }
    />
  );
}

export default AddRule;