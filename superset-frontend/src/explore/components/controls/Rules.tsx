import React, { useState } from 'react';
import ControlHeader from '../ControlHeader';
import AddRule from './AddRule';
import { Modal } from 'react-bootstrap';
import { IRule } from './AddRule/shared';
import EditRuleModalBody from './AddRule/EditRuleModal';
import { t } from '@superset-ui/translation';
import withToasts from 'src/messageToasts/enhancers/withToasts';

interface IRuleProps {
  value: any;
  onChange: Function,
  children: any;
  addSuccessToast: Function,
}

function Rules({ value, onChange = () => {}, ...rest }: IRuleProps) {
  const [rules, setRules] = useState<IRule[]>(value || []);
  const [editRuleIndex, setEditRuleIndex] = useState<number | null>(null);

  const saveRule = (rule: IRule) => {
    const nextRules = [ ...rules ];
    if (editRuleIndex === null) {
      nextRules.push(rule);
    }else {
      nextRules[editRuleIndex] = rule;
    }
    setRules(nextRules);
    onChange(nextRules);
    rest.addSuccessToast(t(`Rule: ${rule.title}, has been ${editRuleIndex === null ? 'saved' : 'updated'}`))
    setEditRuleIndex(null);
  }

  const editRow = (ruleIndex: number) => {
    setEditRuleIndex(ruleIndex);
  }

  const deleteRow = (ruleIndex: number) => {
    const nextRules = [ ...rules ];
    nextRules.splice(ruleIndex, 1);
    setRules(nextRules);
    onChange(nextRules);
  }

  return (
    <div>
      <ControlHeader {...rest} />
      <AddRule
        options={(rest as any).options}
        saveData={saveRule}
      />
      {rules.map((item,i) =>
        <div className="col-sm-12 p-0 form-group" key={"div-"+i} style={{borderBottom: "1px solid #99a2a8"}}>
          <span className="" style={{height: "17px", width: "calc(100% - 25px)"}}>{item.title}</span>
          <div style={{width: "30px", display: "inline-flex", float: "right", marginTop: "4px"}}>
            <span 
              key={"edit-"+i}
              role="button"
              onClick={() => editRow(i)}
            >
              <i className="fa fa-edit" style={{marginTop: ""}}></i>
            </span>
            <span 
              key={"delete-"+i}
              role="button"
              onClick={() => deleteRow(i)}
            >
              <i className="fa fa-times-circle-o" style={{paddingLeft: "5px"}}></i>
            </span>
          </div>
        </div>
      )}
      {editRuleIndex !== null && (
        <Modal 
          dialogClassName={'addRule-dialog'}
          show
          onHide={() => setEditRuleIndex(null)}
          bsSize="large"
        >
          <Modal.Header closeButton>
            <Modal.Title>Edit Rule: {rules[editRuleIndex].title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <EditRuleModalBody
              onSubmit={saveRule}
              rule={rules[editRuleIndex]}
              options={(rest as any).options}
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
}

export default withToasts(Rules);