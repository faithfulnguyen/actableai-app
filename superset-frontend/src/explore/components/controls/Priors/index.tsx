import React from 'react'
import { Col, FormControl, Panel, PanelGroup, Row } from 'react-bootstrap';
import { categoricalTypes } from 'src/explore/controlPanels/Utils';
import ControlHeader from '../../ControlHeader';
import SelectControl from '../SelectControl';

interface IPriorsControlProps {
  value: IPrior[];
  onChange: Function,
  children: any;
  columns: any[];
  state: IState;
}

function PriorsControl({ value, onChange = () => {}, state ,...rest }: IPriorsControlProps) {
  const validate = (selectedPrior: IPrior) => {
    const columnNameError = !selectedPrior.columnName && 'This field cannot be empty';

    const columnValueError = selectedPrior.isCategorical && (
      !selectedPrior.columnValue && 'This field cannot be empty');
      
    const polynomialValueError = !selectedPrior.isCategorical && (
      (selectedPrior.polynomialDegree < 1 && 'This field should be >= 1')
      || (selectedPrior.polynomialDegree > state.controls.polynomial_degree?.value && `This field should be <= ${state.controls.polynomial_degree?.value}`));
    if(selectedPrior.isCategorical && !selectedPrior.columnValue) {

    }
    if(columnNameError) selectedPrior.errors.columnName = columnNameError;
    if(columnValueError) selectedPrior.errors.columnValue = columnValueError;
    if(polynomialValueError) selectedPrior.errors.polynomialValue = polynomialValueError;
  }
  
  const onChangeProperty = (index: number, propertyName: string, newValue: any) => {
    const nextValue = [ ...value ];
    const selectedPrior: IPrior = nextValue[index];
    selectedPrior.errors = {};
    selectedPrior[propertyName] = newValue;
    if (propertyName === 'columnName') {
      selectedPrior.isCategorical = categoricalTypes.includes(
        state.datasource.columns.filter(
          column => column.column_name === newValue
        )[0]?.type
      );
      selectedPrior.polynomialDegree = 1
      selectedPrior.columnValue = '';
    }
    validate(selectedPrior);
    onChange(nextValue);
  }

  const addPrior = () => {
    const nextValue = [ ...value ];
    const newPrior = {
      columnName: '',
      columnValue: '',
      polynomialDegree: 1,
      isCategorical: false,
      priorValue: 0,
      errors: {}
    };
    validate(newPrior);
    nextValue.push(newPrior);
    onChange(nextValue);
  }

  const removePrior = (index: number) => {
    const nextValue = [ ...value ];
    nextValue.splice(index, 1);
    onChange(nextValue);
  }

  const selectedNonCategoricalColumns = value
    .filter(prior => !prior.isCategorical && prior.columnName !== '')
    .map(prior => prior.columnName);

  const getAvailableColumns = (allow: string) => rest.columns
    .filter(column => column.value === allow || !selectedNonCategoricalColumns.includes(column.value));

  const getAvailableColumnValue = (columnName: string, allow: string) => {
    const selectedValues = value?.filter(prior => prior.columnName === columnName)
      .map(prior => prior.columnValue);
    
    return state.datasource.group_values[columnName]
      ?.filter(option => option.value === allow || !selectedValues?.includes(option.value))
  }

  return (
    <PanelGroup>
      {value.map((prior, index) => prior && (
        <Panel
          key={index.toString()} 
          defaultExpanded={index === 1}
          style={{
            marginBottom: '15px',
            border: '1px solid #ddd'
          }}
        >
          <Panel.Heading>
            <Panel.Title toggle componentClass="h3" color={Object.keys(prior.errors).length === 0 ? '' : 'danger'}>
              {prior?.columnName ? `${prior?.columnName}: ${prior?.isCategorical ? prior?.columnValue : prior.polynomialDegree}` : 'New Prior'}
            </Panel.Title>
          </Panel.Heading>
          <Panel.Collapse>
            <Panel.Body>
              <Row className='form-group'>
                <Col xs={6}>
                  <SelectControl
                    name='columnName'
                    label="Column nalue"
                    value={prior.columnName}
                    onChange={(columnValue: any) => onChangeProperty(index, 'columnName', columnValue)}
                    options={getAvailableColumns(prior.columnName)}
                    clearable={false}
                    validationErrors={prior.errors.columnName && [prior.errors.columnName]}
                    style={{
                      border: `1px solid #${prior.errors.columnName ? 'fe4a49' : 'E3EEFD'}`
                    }}
                  />
                </Col>
                <Col xs={6}>
                  <SelectControl
                    name='columnValue'
                    label="Column value"
                    value={prior.columnValue}
                    onChange={(columnValue: any) => onChangeProperty(index, 'columnValue', columnValue)}
                    options={prior.isCategorical ? getAvailableColumnValue(prior.columnName, prior.columnValue) : []}
                    clearable={false}
                    disabled={!prior.isCategorical}
                    validationErrors={prior.errors.columnValue && [prior.errors.columnValue]}
                    style={{
                      border: `1px solid #${prior.errors.columnValue ? 'fe4a49' : 'E3EEFD'}`
                    }}
                  />
                </Col>
              </Row>
              <Row className='form-group'>
                <Col xs={6}>
                  <ControlHeader
                    label='Polynomial value'
                    validationErrors={prior.errors.polynomialDegree && [prior.errors.polynomialDegree]}
                  />
                  <FormControl
                    style={{height: '48px', background: 'white', border: `1px solid #${prior.errors.polynomialDegree ? 'fe4a49' : 'E3EEFD'}`}}
                    name='polynomialDegree'
                    value={prior.polynomialDegree}
                    max={state.controls.polynomial_degree?.value}
                    min={1}
                    onChange={(e: any) => onChangeProperty(index, 'polynomialDegree', e.target.value)}
                    type='number'
                    disabled={prior.isCategorical}
                    // validationErrors={prior.errors.polynomialValue}
                  />
                </Col>
                <Col xs={6}>
                  <ControlHeader
                    label='Prior value'
                  />
                  <FormControl
                    style={{height: '48px', background: 'white', border: `1px solid #${prior.errors.priorValue ? 'fe4a49' : 'E3EEFD'}`}}
                    name='priorValue'
                    value={prior.priorValue}
                    onChange={(e: any) => onChangeProperty(index, 'priorValue', e.target.value)}
                    type='number'
                  />
                </Col>
              </Row>
              <Row>
                <Col xs={12}>
                  <button
                    className='btn btn-danger'
                    onClick={() => removePrior(index)}
                    style={{ width: '100%', padding: '10px 0', textAlign: 'center' }}
                  >
                    X
                  </button>
                </Col>
              </Row>
            </Panel.Body>
          </Panel.Collapse>
        </Panel>
      ))}
      <div className='row'>
        <div className='col-xs-12'>
          <button className='btn btn-success' onClick={addPrior}>
            Add Prior
          </button>
        </div>
      </div>
    </PanelGroup>
  );
}

export default PriorsControl
