import { t } from '@superset-ui/translation';
import React, { useState } from 'react'
import Button from 'src/components/Button';
import styled from 'styled-components'

const Container = styled.div`
  min-width: 100%;
  min-height: 100%;
  display: grid;
  place-items: center;
  grid-auto-flow: rows;

  & > div {
    display: grid;
    place-items: center;
    grid-auto-flow: rows;
  }
`;

const StyledButton = styled(Button)`
  font-family: Roboto;
  font-size: 15px;
  line-height: 28px;
  color: #FFFFFF;
  border-radius: 4px;
  padding: 4px 20px;
  display: block;
  margin-top: 8px;
`;

interface IPendingChartProps {
  reQuery: () => void;
}

function PendingChart({ reQuery }: IPendingChartProps) {
  const [isDisabled, setIsDisabled] = useState(false);

  const onClick = () => {
    try {
      reQuery();
      setIsDisabled(true);
    } catch (e) {
    }
  }

  return (
    <Container>
      <div>
        <div>
          {t('There was an issue retrieving this data would you like to regenerate it?')}
        </div>
        <StyledButton bsStyle="success" onClick={onClick} disabled={isDisabled}>
          {t('Regenerate results')}
        </StyledButton>
      </div>
    </Container>
  )
}

export default PendingChart
