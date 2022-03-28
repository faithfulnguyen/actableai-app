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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as billingActions from '../actions/index';
import _ from 'lodash';
import { FormControl, Button } from 'react-bootstrap';
import { TYPE_PLAN, CYCLE_TYPE, PAGE } from '../constants/index';

const propTypes = {
  name: PropTypes.string,
  price: PropTypes.number,
  description: PropTypes.string
};

class RoleItem extends React.Component {
  constructor(props) {
    super(props);
    this.onChoose = this.onChoose.bind(this);
    this.renderDes = this.renderDes.bind(this);
    this.renderSubprice = this.renderSubprice.bind(this);
  }

  async onChoose() {
    const { id, type } = this.props.plan;
    if (type === TYPE_PLAN.CONTACT_US) {
      window.open('https://actable.ai/company/contact-us');
    } else {
      await this.props.actions.choosePlan(id);
      await this.props.actions.updatePageNumber(PAGE.CONTACT);
    }
  }

  renderDes() {
    const { cycleType, plan: { type, number_of_hours }} = this.props;
    if (type === TYPE_PLAN.USAGE_BASED) {
      return <p>Run analytics: <strong>{number_of_hours}h/month</strong></p>;
    }
    if (type === TYPE_PLAN.USAGE_UNLIMITED) {
      return <p>Run analytics: <strong>no time limit</strong></p>;
    }
    return <p>via <a href="mailto:contact@actable.ai"><strong>email</strong></a> or contact form</p>;
  }

  renderSubprice() {
    const { cycleType, plan: { type }} = this.props;
    if (type === TYPE_PLAN.CONTACT_US) {
      return <p>More users & other needs</p>;
    }
    return <p>per month billed {cycleType === CYCLE_TYPE.MONTHLY ? 'monthly' : 'yearly'}</p>
  }

  render() {
    const { plan, cycleType } = this.props;
    const { name, type, price, number_of_hours, description, annual_price } = plan;

    return (
      <div className='plan-option'>
        <h4 className='plan-name'>{name}</h4>
        <p className='plan-price'>{type === TYPE_PLAN.CONTACT_US ? price : `$${cycleType === CYCLE_TYPE.MONTHLY ? price : annual_price}`}</p>
        <p className='sub-price'>{this.renderSubprice()}</p>
        <div className='choose-plan'>
          <Button name={name.toLowerCase()} bsStyle="primary" onClick={this.onChoose}>{type === TYPE_PLAN.CONTACT_US ? 'Contact us' : 'Buy Now'}</Button>
        </div>
        <hr />
        <p className='plan-des'>{this.renderDes()}</p>
        {description && (
          <div>
            <hr />
            <p className='plan-des'>{description}</p>
          </div>
        )}
      </div>
    )
  }
}

RoleItem.propTypes = propTypes;

function mapStateToProps(state) {
  return { ...state.billing.choosePlan };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({},
    billingActions,
  );
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { RoleItem };
export default connect(mapStateToProps, mapDispatchToProps)(RoleItem);
