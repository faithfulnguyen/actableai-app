import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';
import { categoricalTypes, getColumnDataType, getMutauallyExculusiveOptions, numericTypes } from './Utils';

const mutuallyExculsiveMultiDropdowns = ['treatment'];
const mutuallyExculsiveDropdowns = ['outcome'];

const exclusiveOptions = (state, fieldName, whitelistTypes) => getMutauallyExculusiveOptions(state, fieldName, mutuallyExculsiveMultiDropdowns, mutuallyExculsiveDropdowns, whitelistTypes);

const typeOfANOVA = [
  {
    value: 1,
    label: 'One-way ANOVA',
  },
  {
    value: 2,
    label: 'Two-way ANOVA',
  },
]

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'anovaType',
            config: {
              type: 'SelectControl',
              label: t('N-way ANOVA'),
              description: t(
                'select the type of ANOVA',
              ),
              default: typeOfANOVA[0].value,
              options: typeOfANOVA,
              dependents: [
                'treatment'
              ],
              clearable: false,
            },
          },
        ],
        ['outcome'],
        ['treatment'],
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    outcome: {
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'outcome', numericTypes) }),
    },
    treatment: {
      multi: true,
      label: t('Treatment(s)'),
      mapStateToProps: (state) => ({ options: exclusiveOptions(state, 'treatment', categoricalTypes) }),
      validators: [(value, state) => {
        if(!state) return false;
        const treatment = value || state.form_data.treatment;
        if(!treatment) return false;
        const anovaType = state?.controls?.anovaType?.value || state.form_data.anovaType;
        if(anovaType === treatment.length) return false;
        const selectedANOVAType = typeOfANOVA[(state?.controls?.anovaType?.value || 1) - 1];
        return `${selectedANOVAType.label} requires the treatment to contain ${selectedANOVAType.value} value(s)`
      }],
    }
  },
};
