import { t } from '@superset-ui/translation';
import React from 'react'
import TooltipWrapper from 'src/components/TooltipWrapper';
import MisplacedRules from './MisplacedRules';
import ValidationRules from './ValidationRules';
import { Tab } from 'react-bootstrap'
import { useFormik } from 'formik';
import { IRule } from './shared';
import InfoTooltipWithTrigger from 'src/components/InfoTooltipWithTrigger';
import Tabs from 'src/components/Tabs';
import { addRuleSchema } from 'src/utils/schemas';

interface IEditRuleModalBoddyProps {
  rule?: IRule;
  onSubmit: (data: any) => void;
  options: any[];
}

function EditRuleModalBody({ rule, onSubmit, options }: IEditRuleModalBoddyProps) {
  const { values, errors, handleChange, handleSubmit, setFieldValue, isValid } = useFormik<IRule>({
    onSubmit,
    validationSchema: addRuleSchema,
    initialValues: rule || {
      title: '',
      misplaced: [],
      validations: []
    }
  })

  return (
    <form className="row" onSubmit={handleSubmit}>
      <div className="col-sm-12 form-group">
        <div className="col-sm-12 form-group">
          <strong>
            {t('Instructions of how to add rules can be found at this ')}
            <a href="https://docs.actable.ai/analytics.html#data-cleanse-imputation" target='_blank'>{t('tutorial')}</a>
          </strong>
        </div>
      </div>
      <div className="col-sm-12 form-group">
        <span className="col-sm-12 form-group">
          <span className={errors.title ? "text-danger" : ""}>Rule title</span>
          &nbsp;
          {errors.title && (
            <TooltipWrapper
              label="title"
              tooltip={errors.title}
            >
              <span><i className="fa fa-exclamation-circle text-danger"></i> </span>
            </TooltipWrapper>
          )}
          </span>
        
        <div className="col-sm-9 form-group">
          <input 
            name="title"
            className="form-control"
            value={values.title} 
            onChange={handleChange}
          />
        </div>
      </div>
      <div className="col-sm-12 form-group">
        <div className="col-sm-12">
          <Tabs defaultActiveKey="validation" className="sm-12">
            <Tab eventKey="validation" title={(
              <span className={errors.validations ? 'text-danger' : ''}>
                {t("Validation")}
                {' '}
                <span>
                  <InfoTooltipWithTrigger
                    label={t('description')}
                    tooltip={`Define the value relationship between multiple columns by comparing values in any two rows.`}
                    placement="top"
                  />
                </span>
              </span>
            )}>
                <ValidationRules
                  errors={errors.validations}
                  validations={values.validations}
                  setFieldValue={setFieldValue}
                  options={options}
                />
            </Tab>
            <Tab eventKey="misplaced" title={(
              <span className={errors.misplaced ? 'text-danger' : ''}>
                {t("Misplaced")}
                {' '}
                <span>
                  <InfoTooltipWithTrigger
                    label={t('description')}
                    tooltip={`Hard code to mark a specific value as invalid.`}
                    placement="top"
                  />
                </span>
              </span>
            )}>
                <MisplacedRules
                  errors={errors.misplaced}
                  misplaced={values.misplaced}
                  setFieldValue={setFieldValue}
                  options={options}
                />
            </Tab>
          </Tabs>
        </div>
      </div>
      <div className="col-sm-12">
        <div className="col-sm-12">
          <button disabled={!isValid} className="btn btn-primary" type="submit">
            {rule ? t('Update Rule') : t('Save Rule')}
          </button>
        </div>
      </div>
    </form>
  );
}

export default EditRuleModalBody
