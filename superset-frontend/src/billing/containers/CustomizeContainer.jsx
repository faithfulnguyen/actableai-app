/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, Button, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import _ from 'lodash';
import PlanItem from '../components/PlanItem';
import { CYCLE_TYPE, PAGE } from '../constants/index';

const propTypes = {
  roles: PropTypes.array,
  total: PropTypes.number
};

export default class CustomizeContainer extends React.Component {
  constructor(props) {
    super(props);
    this.onClickBack = this.onClickBack.bind(this);
    this.switchCycle = this.switchCycle.bind(this);
  }

  async onClickBack() {
    await this.props.actions.updatePageNumber(PAGE.INFO);
  }

  async switchCycle(e) {
    const { value } = e.currentTarget.querySelector(".active > input");
    await this.props.actions.switchCycle(value);
  }

  render() {
    const { plans, total, subscription, choosePlan } = this.props;
    const choosePlans = _.filter(plans, (o) => o.is_active && o.type != 'USAGE_TRIAL');

    return (
      <div>
        <div className='cycle-switch'>
          <ToggleButtonGroup type="radio" name="options" value={choosePlan.cycleType} onClick={this.switchCycle}>
            <ToggleButton value={CYCLE_TYPE.ANNUALLY}>Billed Annually</ToggleButton>
            <ToggleButton value={CYCLE_TYPE.MONTHLY}>Billed Monthly</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className='plan-list'>
          {_.orderBy(choosePlans, ['price', 'age']).map((plan) => {
            return <PlanItem
              {...this.props}
              key={plan.key}
              plan={plan}
            />
          })}
        </div>
        {subscription && (
          <div className='contact-footer'>
            <Button bsStyle="primary" onClick={this.onClickBack}>BACK</Button>
          </div>
        )}
      </div>
    )
  }
}

CustomizeContainer.propTypes = propTypes;
