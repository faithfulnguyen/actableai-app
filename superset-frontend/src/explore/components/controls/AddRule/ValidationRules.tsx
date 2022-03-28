import { t } from '@superset-ui/translation'
import React from 'react'
import { ListGroupItem, Panel, PanelGroup } from 'react-bootstrap'
import TooltipWrapper from 'src/components/TooltipWrapper'
import AddRuleStatement from './AddRuleStatement'
import { createNewRuleStatementPart, IValidationRuleStatement } from './shared'
import ValidationRuleStatementPart from './ValidationRuleStatementPart'

interface IValidationRulesProps {
  validations: IValidationRuleStatement[];
  setFieldValue: Function;
  options: any[];
  errors?: any;
}

function ValidationRules({ errors, validations, setFieldValue, options }: IValidationRulesProps) {
  const addRuleStatementPart = (validationIndex: number, type: 'when' | 'then') => () => {
    const nextValidations = [...validations];
    nextValidations[validationIndex][type].push(createNewRuleStatementPart())
    setFieldValue('validations', nextValidations);
  }

  const addRuleStatement = () => {
    const nextValidations = [...validations];
    nextValidations.push({ when: [createNewRuleStatementPart()], then: [createNewRuleStatementPart()] });
    setFieldValue('validations', nextValidations);
  }
  
  const deleteStatementPart = (validationIndex: number, type: 'when' | 'then') => (index: number) => {
    const nextValidations = [...validations];
    nextValidations[validationIndex][type].splice(index, 1);
    setFieldValue('validations', nextValidations)
  }

  const deleteStatement = (validationIndex: number) => {
    const nextValidations = [...validations];
    nextValidations.splice(validationIndex, 1);
    setFieldValue('validations', nextValidations)
  }
  
  return (
    <div>
      <br />
      <PanelGroup id="validationRulesPanels" accordion defaultActiveKey={1}>
        {validations.map((validation, validationIndex) => (
          <>
            {validationIndex > 0 ? (
              <div style={{display: 'flex', alignItems: 'center'}}>
                <hr style={{flex:1}}></hr>
                <div style={{padding: '0 10px', fontWeight: 'bold'}}>{t('OR')}</div>
                <hr style={{flex:1}}></hr>
              </div>
            ) : <></>}
            <Panel key={validationIndex} eventKey={validationIndex + 1} style={{
              border: '1px solid #ddd'
            }}>
              <Panel.Toggle>
                <Panel.Heading>
                  <Panel.Title componentClass="h3" className={errors?.[validationIndex] ? 'text-danger' : ''}>
                    {`${t('Rule Statement')} ${validationIndex + 1}`}
                    &nbsp;
                    {errors?.[validationIndex] && (
                      <TooltipWrapper
                        label="title"
                        tooltip={"There must be at least 1 statement in both the 'When' and 'Then' sections and all of the fields must be selected."}
                      >
                        <span><i className="fa fa-exclamation-circle text-danger"></i> </span>
                      </TooltipWrapper>
                    )}
                  </Panel.Title>
                </Panel.Heading>
              </Panel.Toggle>
              <Panel.Body collapsible style={{ padding: 0 }}>
                <ListGroupItem style={{border: 'none', borderTop: '1px solid #ddd'}}>
                  <h4>{t('When')}</h4>
                  {validation.when.map((statement, whenIndex) => (
                    <ValidationRuleStatementPart 
                      key={whenIndex}
                      index={whenIndex}
                      statement={statement}
                      deleteStatementPart={deleteStatementPart(validationIndex, 'when')}
                      setFieldValue={(field: string, value: any) => {
                        setFieldValue(`validations.${validationIndex}.when.${whenIndex}.${field}`, value);
                      }}
                      options={options}
                      errors={errors?.[validationIndex]?.when?.[whenIndex]}
                    />
                  ))}
                  <AddRuleStatement onClick={addRuleStatementPart(validationIndex, 'when')} />
                </ListGroupItem>
                <ListGroupItem style={{border: 'none', borderTop: '1px solid #ddd'}}>
                  <h4>{t('Then')}</h4>
                  {validation.then.map((statement,  thenIndex) => (
                    <ValidationRuleStatementPart 
                      key={thenIndex}
                      index={thenIndex}
                      statement={statement}
                      deleteStatementPart={deleteStatementPart(validationIndex, 'then')}
                      setFieldValue={(field: string, value: any) => {
                        setFieldValue(`validations.${validationIndex}.then.${thenIndex}.${field}`, value);
                      }}
                      options={options}
                      errors={errors?.[validationIndex]?.then?.[thenIndex]}
                    />
                  ))}
                  <AddRuleStatement onClick={addRuleStatementPart(validationIndex, 'then')} />
                </ListGroupItem>
                <ListGroupItem style={{border: 'none', borderTop: '1px solid #ddd'}}>
                  <button className="btn btn-danger" type="button" onClick={() => deleteStatement(validationIndex)}>
                    {t('Remove Rule Statement')} {validationIndex + 1}
                    &nbsp;
                    <span>
                      <i className="fa fa-times"></i>
                    </span>
                  </button>
                </ListGroupItem>
              </Panel.Body>
            </Panel>
          </>
        ))}
      </PanelGroup>
      <button className="btn btn-primary" type="button" onClick={addRuleStatement}>
        {t('Add Rule Statement')}
        &nbsp;
        <span>
          <i className="fa fa-plus"></i>
        </span>
      </button>
    </div>
  )
}

export default ValidationRules
