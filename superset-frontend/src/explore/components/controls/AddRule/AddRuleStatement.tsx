import React from 'react'
import TooltipWrapper from 'src/components/TooltipWrapper'

interface IAddRuleStatementProps {
  onClick: () => void;
  isMisplacedRules?: boolean;
}

function AddRuleStatement({ onClick, isMisplacedRules }: IAddRuleStatementProps) {
  const buttonText = `Add Rule ${isMisplacedRules ? '' : 'Statement Part'}`;
  
  return (
    <div>
      <div>
        <TooltipWrapper
          label="select-rule"
          tooltip={buttonText}
        >
          <button className="btn btn-primary" type="button" onClick={onClick}>
            {buttonText}
            &nbsp;
            <span>
              <i className="fa fa-plus"></i>
            </span>
          </button>
        </TooltipWrapper>
      </div>
    </div>
  )
}

export default AddRuleStatement
