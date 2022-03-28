import styled from "styled-components";
import Spacer, { ISpacerProps } from "./Spacer";

interface IDividerProps extends ISpacerProps {
  background?: string;
}

const Divider = styled(Spacer)<IDividerProps>`
  background: ${props => props.background || '#072773'};
  border-radius: 2px;
`;

export default Divider;