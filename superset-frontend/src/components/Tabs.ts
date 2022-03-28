import { Tabs as BTabs } from 'react-bootstrap';
import styled from 'styled-components';

const Tabs = styled(BTabs)`
  .nav-tabs {
    border-bottom: 1px solid #cfd8dc;

    li > a {
      border: 1px solid transparent;

      &:hover {
        border-top: 3px solid transparent;
        color: #0D296F;
      }
    }

    li.active > a {
      border: 1px solid #cfd8dc;
      border-bottom-color: transparent;
      border-top: 3px solid #0D296F;
      color: #0D296F;
    }
  }
`;

export default Tabs;

