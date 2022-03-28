import React, { DOMAttributes } from 'react'
import { gtagEvent } from 'src/utils/googleAnalyticsTracking';
import styled from 'styled-components';

const Container = styled.div``;

interface IGtagEventProps extends DOMAttributes<any> {
  eventLabel: string;
}

function GtagEvent({ children, eventLabel, onClick, ...rest }: IGtagEventProps) {
  const handleCLick: React.MouseEventHandler = (event) => {
    gtagEvent('User', 'Click', eventLabel);
    onClick?.(event);
  }
  
  return (
    <Container onClick={handleCLick} {...rest}>
      {children}
    </Container>
  )
}

export default GtagEvent;
