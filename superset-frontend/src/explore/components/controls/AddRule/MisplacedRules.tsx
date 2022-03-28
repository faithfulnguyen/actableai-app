import React from 'react'
import TooltipWrapper from 'src/components/TooltipWrapper'
import AddRuleStatement from './AddRuleStatement'
import MisplacedRuleStatement from './MisplacedRuleStatement'
import { createNewMisplacedStatement, TMisplacedStatement } from './shared'

interface IMisplacedRulesProps {
  misplaced: TMisplacedStatement[];
  setFieldValue: (field: string, value: any) => any;
  options: any[];
  errors?: any;
}

function MisplacedRules({ errors, misplaced, setFieldValue, options }: IMisplacedRulesProps) {
  const addRuleStatement = () => {
    const nextMispalced = [...misplaced];
    nextMispalced.push(createNewMisplacedStatement())
    setFieldValue('misplaced', nextMispalced);
  }

  const deleteStatementPart = (index: number) => {
    const nextMispalced = [...misplaced];
    nextMispalced.splice(index, 1)
    setFieldValue('misplaced', nextMispalced);
  }
  
  return (
    <div>
      <br />
      {errors && (
        <>
          <TooltipWrapper
            label="title"
            tooltip={"All of the fields are required."}
          >
            <span><i className="fa fa-exclamation-circle text-danger"></i> </span>
          </TooltipWrapper>
          <br />
        </>
      )}
      {misplaced.map((statement, index) => 
        <MisplacedRuleStatement
          key={index}
          index={index}
          statement={statement}
          deleteStatementPart={deleteStatementPart}
          setFieldValue={(field: string, value: any) => {
            setFieldValue(`misplaced.${index}.${field}`, value)
          }}
          options={options}
          errors={errors?.[index]}
        />
      )}
      <AddRuleStatement onClick={addRuleStatement} isMisplacedRules />
    </div>
  )
}

export default MisplacedRules
