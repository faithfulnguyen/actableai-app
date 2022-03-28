import React from 'react'
import styled from 'styled-components';

const Container = styled.div`
  background: #072773;
  position: relative;
  height: 45px;
  color: white;
  overflow: hidden;
  box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.25);
`;

const Content = styled.div`
  padding: 12px;
  text-align: center;
`;

const CloseButton = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  cursor: pointer;
`;

interface Props {
  withClose?: boolean;
  children: React.ReactNode;
  onClose?: (event: any) => void;
}

function ModalHeader({ children, onClose }: Props) {
  return (
    <Container>
      <Content>
        {children}
      </Content>
      {onClose && (
        <CloseButton onClick={onClose}>
          X
        </CloseButton>
      )}
    </Container>
  )
}

export default ModalHeader