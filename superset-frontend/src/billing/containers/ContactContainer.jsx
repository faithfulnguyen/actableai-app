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
import _ from 'lodash';
import { FormGroup, ControlLabel, FormControl, Button, Checkbox } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import InputItem from '../components/InputItem';
import CountrySelector from '../components/CountrySelector';
import PhoneSelector from '../components/PhoneSelector';
import { PAGE } from '../constants/index';

const propTypes = {};

export default class ContactContainer extends React.Component {
  constructor(props) {
    super(props);
    this.onClickNextPayment = this.onClickNextPayment.bind(this);
    this.onClickBack = this.onClickBack.bind(this);
    this.getInputRequired = this.getInputRequired.bind(this);
  }

  getInputRequired() {
    return [
      'firstName',
      'lastName',
      'email',
      'phone',
      'billingAddress1',
      'billingCity'
    ];
  }

  async onClickNextPayment(e) {
    e.preventDefault();

    const { info } = this.props;
    const inputRequired = this.getInputRequired();
    const valueRequired = _.pick(info, inputRequired);
    const valueArray = _.values(valueRequired);

    if (valueArray.indexOf('') === -1 && valueArray.indexOf(null) === -1) {
      await this.props.actions.updatePageNumber(PAGE.PAYMENT);
    }
  }

  async onClickBack() {
    await this.props.actions.updatePageNumber(PAGE.PLAN_LIST);
    await this.props.actions.updateAttribute('checkValidateInfo', false);
  }

  async componentDidMount() {
    const { customer } = this.props;

    if (customer) {
      await this.props.actions.updateInfos({
        phone: customer.phone,
        billingCountry: customer.address.country,
        billingAddress1: customer.address.line1,
        billingAddress2: customer.address.line2,
        billingState: customer.address.state,
        billingCity: customer.address.city,
        billingZip: customer.address.postal_code
      });
    }
  }

  render() {
    const { info } = this.props;

    return (
      <div>
        <form onSubmit={this.onClickNextPayment}>
          <div className='contact-body'>
            <div>
              <div>
                <h4>Billing Info</h4>
                <InputItem source='firstName' label='First Name *' required />
                <InputItem source='lastName' label='Last Name *' required />
              </div>
              <div>
                <h4>Contact Info</h4>
                <InputItem source='email' label='Email *' required />
                <PhoneSelector />
              </div>
            </div>
            <div>
              <h4>Billing Address</h4>
              <CountrySelector source='billingCountry' />
              <InputItem source='billingAddress1' label='Address *' required />
              <InputItem source='billingAddress2' />
              <InputItem source='billingCity' label='City *' required />
              <InputItem source='billingState' label='State/Province' />
              <InputItem source='billingZip' label='Zip/Postal Code' />
            </div>
          </div>
          <div className='contact-footer'>
            <Button bsStyle="primary" onClick={this.onClickBack}>BACK</Button>
            <Button bsStyle="primary" type="submit">CONTINUE TO SUMMARY & PAYMENT</Button>
          </div>
        </form>
      </div>
    )
  }
}

ContactContainer.propTypes = propTypes;
