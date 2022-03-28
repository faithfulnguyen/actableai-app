import styled from "styled-components";

const logoUrls = {
  logoWithText: '/static/assets/images/logo-blue.png',
}

interface ILogoProps {
  width: string;
  height: string;
  type?: 'logo' | 'text' | 'logoWithText'
}

const Logo = styled.div<ILogoProps>`
  width: ${props => props.width};
  height: ${props => props.height};
  background: url('${props => props.type && logoUrls[props.type] ? logoUrls[props.type] : logoUrls.logoWithText}');
  background-size: contain;
`;

export default Logo;