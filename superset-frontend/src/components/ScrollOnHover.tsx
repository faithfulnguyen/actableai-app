import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

interface IRootProps {
  children: React.ReactNode;
  overflowX?: number;
}

const Wrapper = styled.div<IRootProps>`
  overflow: hidden;

  &:hover > div {
    left: -${(props) => props.overflowX || 0}px;
  }
`;

const Container = styled.div<any>`
  transition: left ${(props) => props.overflowX * 15}ms linear;
  position: relative;
  left: 0;
  color: inherit;
  white-space: nowrap;
`;

function ScrollOnHover({ children, ...props }: IRootProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [overflowX, setOverflowX] = useState(0);

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return;
    setOverflowX(element.scrollWidth - element.clientWidth);
  }, [children, scrollRef.current]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Wrapper overflowX={overflowX} {...props}>
      <Container overflowX={overflowX} ref={scrollRef}>
        {children}
      </Container>
    </Wrapper>
  );
}

export default ScrollOnHover;
