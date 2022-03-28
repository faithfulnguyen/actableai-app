import React from 'react'
import Select from '../../../../components/Input/Select/Select'
import { dropConditions, TValidationStatementPart } from './shared'

interface IRuleStatementProps {
  index: number;
  statement: TValidationStatementPart;
  setFieldValue: (field: string, value: any) => void;
  deleteStatementPart: (index: number) => void;
  options: any[];
  errors: any;
}

function ValidationRuleStatementPart({ 
  index,
  statement,
  setFieldValue,
  deleteStatementPart,
  options,
  errors,
}: IRuleStatementProps) {
  return (
    <div className="form-group">
      <div className="row">
        <div className="col-sm-3">
          <Select
            placeholder={"Select column"}
            options={options}
            onChange={(value) => setFieldValue('column', value)}
            value={statement.column}
            menuPortalTarget={document.body}
            key={"colun"+index}
            inModal
            styles={{control: (p) => ({...p, borderColor: errors?.column ? '#fe4a49' : p.borderColor })}}
          />
        </div>
        <div className="col-sm-3">
          <Select
            placeholder={"Select operator"}
            options={dropConditions as any}
            value={statement.operator}
            onChange={(value) => setFieldValue('operator', value)}
            inModal
            styles={{control: (p) => ({...p, borderColor: errors?.operator ? '#fe4a49' : p.borderColor })}}
          />
        </div>
        <div className="col-sm-3">
          <Select 
            placeholder={"Select column"}
            options={options}
            value={statement.comparedColumn}
            onChange={(value) => setFieldValue('comparedColumn', value)}
            inModal
            styles={{control: (p) => ({...p, borderColor: errors?.comparedColumn ? '#fe4a49' : p.borderColor })}}
          />
        </div>
        <div className="col-sm-3">
          <span
            role="button"
            onClick={() => deleteStatementPart(index)}
          >
            <i className="fa fa-times-circle-o" style={{ lineHeight: '38px', fontSize: '32px' }}/>
          </span>
        </div>
      </div>
    </div>
  )
}

export default ValidationRuleStatementPart
