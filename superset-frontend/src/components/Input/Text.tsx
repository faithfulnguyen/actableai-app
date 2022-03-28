import { FieldMetaProps, useField } from 'formik';
import React from 'react'
import styled from 'styled-components';

const Container = styled.div`

`;

const Input = styled.input<FieldMetaProps<any>>`
  height: 40px;
  border: 0;
  border-radius: 8px;
  box-shadow: inset 0px 0px 4px ${props => props.error ? 'rgba(255, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.25)'};
  padding: 12px;
  outline: none;
  width: 100%;

  &:focus-visible {
    outline: 2px solid;
    outline-color: ${props => props.error ? '#f00' : '#072773'};
  }
`;

const Label = styled.label<FieldMetaProps<any>>`
  color: ${props => props.error ? '#f00' : '#072773'};
`;

interface ITextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
}

function TextField({ name, label, ...rest }: ITextFieldProps) {
  const [input, meta] = useField(name);
  
  return (
    <Container id={`TextField-Container-${name}`}>
      <Label {...meta}>{label}</Label>
      <div>
        <Input {...input} {...meta} {...rest} />
      </div>
    </Container>
  )
}

export default TextField