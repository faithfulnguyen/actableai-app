export const responsiveStyle = {
  width: '50vw',
  height: '40vw',
  margin: 'auto',
  minWidth: '600px',
  minHeigh: '450px',
};

export const CONFIDENCE_LEVEL_FACTOR = 1.645;

export const MAIN_FACTOR_COLOR = '#3269a8';

export const CHART_TYPE = {
    CONFUSION_MATRIX: 'cm',
    LINEAR_REGRESSION: 'lr',
    KERNEL_DENSITY_ESTIMATION: 'kde',
};

export const round = (inputNumber: number, numberOfDecimal: number) => {
  const factor = 10 ** numberOfDecimal;
  return Math.round(inputNumber * factor) / factor;
};