import { SingleValue } from "react-select-5"

export interface IBaseRuleStatementPart {
  column: SingleValue<string>;
  operator: SingleValue<string>;
}

export type TMisplacedStatement = IBaseRuleStatementPart & { 
  isRegex: boolean;
  value: string;
};

export type TValidationStatementPart = IBaseRuleStatementPart & {
  comparedColumn: SingleValue<string>;
}

export interface IValidationRuleStatement {
  when: TValidationStatementPart[];
  then: TValidationStatementPart[];
}

export interface IRule {
  title: string;
  validations: IValidationRuleStatement[];
  misplaced: TMisplacedStatement[];
}

export const dropConditions = [
  {label: "",value: ""},
  {label: "<>",value: "<>"},
  {label: "<=",value: "<="},
  {label: ">=",value: ">="},
  {label: "=",value: "="},
  {label: "<",value: "<"},
  {label: ">",value: ">"},
]

export const createNewRuleStatementPart = () => ({column: null, operator: null, comparedColumn: ''});
export const createNewMisplacedStatement = () => ({column: null, operator: null, value: '', isRegex: false});