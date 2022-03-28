import { useFormikContext } from 'formik';
import React, { ButtonHTMLAttributes } from 'react'
import styled from 'styled-components';

type ButtonDesign = 'base' | 'bordered' | 'primary';

interface IContainerProps extends ButtonHTMLAttributes<any> {
  design: ButtonDesign;
}

const Container = styled.button<IContainerProps>`
  display: grid;
  height: 40px;
  box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  border: none;
  display: grid;
  place-items: center;
  ${props => (props.disabled && `
    background-color: #C4C4C4;
    color: white;
    cursor: disabled;
  `) || `
  
  ${(props.design === 'bordered' && `
    background-color: white;
    outline: 2px solid #072773;
    color: #072773;
  `) || (props.design === 'primary' && `
    background-color: #072773;
    color: white;
  `)}

    &:hover {
      box-shadow: 0 0 0 rgba(0, 0, 0, 0.25);
    }

    &:active {
      box-shadow: inset 1px 2px 4px rgba(0, 0, 0, 0.25);
    }
  `}
`;

interface IButtonProps extends IContainerProps {
  children: React.ReactNode;
}

function Button({ children, design = 'base', type = "button", ...rest }: IButtonProps) {
  const { errors } = useFormikContext();
  let disabled = rest.disabled;
  if (type === 'submit') {
    disabled = Object.keys(errors).length !== 0;
  }
  
  return (
    <Container design={design} type={type} {...rest} disabled={disabled}>
      {children}
    </Container>
  )
}

export default Button