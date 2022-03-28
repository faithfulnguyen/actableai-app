import * as yup from 'yup';

const misplacedRuleSchema = yup.object().shape({
  column: yup.object().nullable().required(),
  operator: yup.object().nullable().required(),
  value: yup.string().required(),
  isRegex: yup.boolean()
})

const validationRulePartSchema = yup.object().shape({
  column: yup.object().nullable().required(),
  operator: yup.object().nullable().required(),
  comparedColumn: yup.object().nullable().required()
})

const validationRuleSchema = yup.object().shape({
  when: yup.array(validationRulePartSchema).min(1),
  then: yup.array(validationRulePartSchema).min(1)
})

const addRuleSchema = yup.object().shape({
  title: yup.string().required(),
  validations: yup.array(validationRuleSchema),
  misplaced: yup.array(misplacedRuleSchema),
})

export { addRuleSchema }