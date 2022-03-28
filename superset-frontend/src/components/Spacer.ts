import styled from "styled-components";

export interface ISpacerProps {
  width?: number;
  height?: number;
}

const Spacer = styled.div<ISpacerProps>`
  ${({ width }) => width && `width: ${width}px`};
  ${({ height }) => `height: ${height || 1}px`};
`;

export default Spacer;