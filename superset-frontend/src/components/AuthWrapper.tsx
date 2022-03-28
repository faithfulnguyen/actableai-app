import React, { useEffect } from 'react'
import { useAuthContext } from '../hooks/context'
import styled from 'styled-components';

interface IContainerProps {
  disabledChildren: boolean;
}

const Container = styled.div<IContainerProps>`
  cursor: pointer;
  ${props => props.disabledChildren && `
    & * {
      pointer-events: none;
    }
  `}
`;

interface IAuthWrapper {
  children: React.ReactNode;
  className?: string;
}

function AuthWrapper({ children, className }: IAuthWrapper) {
  const  { user, setIsAuthModalOpen } = useAuthContext();
  
  const shouldOpenModal = !user;

  const onClick = (event: React.MouseEvent) => {
    if (!shouldOpenModal) return;

    event.preventDefault();
    setIsAuthModalOpen(true);
  }

  useEffect(() => {
    (window as any).loginModal = () => setIsAuthModalOpen(true);
  }, [])

  return (
    <Container
      className={className}
      onClick={onClick}
      disabledChildren={shouldOpenModal}
    >
      {children}
    </Container>
  )
}

export default AuthWrapper