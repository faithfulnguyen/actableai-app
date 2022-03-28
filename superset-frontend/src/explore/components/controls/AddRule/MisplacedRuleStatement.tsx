import React from 'react'
import { Checkbox, FormControl } from 'react-bootstrap'
import Select from '../../../../components/Input/Select/Select';
import { dropConditions, TMisplacedStatement } from './shared'

interface IRuleStatementProps {
  index: number;
  statement: TMisplacedStatement;
  setFieldValue: (field: string, value: any) => void;
  deleteStatementPart: (index: number) => void;
  options: any[];
  errors?: any;
}

function MisplacedRuleStatement({ 
  index,
  statement,
  setFieldValue,
  deleteStatementPart,
  options,
  errors
}: IRuleStatementProps) {
  return (
    <div className="form-group">
      <div className="row">
        <div className="col-sm-3">
          <Select
            placeholder={"Select column"}
            onChange={(value) => setFieldValue('column', value)}
            value={statement.column}
            key={"column"+index}
            menuPortalTarget={document.body}
            options={options}
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
            key={"operator"+index}
            inModal
            styles={{control: (p) => ({...p, borderColor: errors?.operator ? '#fe4a49' : p.borderColor })}}
          />
        </div>
        <div className="col-sm-3">
          <FormControl
            placeholder={"Select value"}
            value={statement.value}
            onChange={(event: any) => setFieldValue('value', event.target.value)}
            key={"value"+index}
            style={{
              height: '38px',
              borderColor: errors?.value ? '#fe4a49' : undefined
            }}
          />
        </div>
        <div className="col-sm-2" style={{height: '38px', display: 'flex', alignItems: 'center'}}>
          <Checkbox style={{ margin: 0}} checked={statement.isRegex} onChange={() => setFieldValue('isRegex', !statement.isRegex)}>
            RegEx?
          </Checkbox>
        </div>
        <div className="col-sm-1">
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

export default MisplacedRuleStatement
