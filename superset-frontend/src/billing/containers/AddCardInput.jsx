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
import { injectStripe } from 'react-stripe-elements';
import { SupersetClient } from '@superset-ui/connection';
import { FormGroup, ControlLabel, FormControl, Button, Checkbox } from 'react-bootstrap';
import CardSection from './CardSection';
import { INPUT_ERROR, PAGE } from '../constants/index';

class AddCardInput extends React.Component {
  constructor(props) {
    super(props);
    this.onChangeCardHolderName = this.onChangeCardHolderName.bind(this);
    this.onClickBack = this.onClickBack.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.onMakeDefault = this.onMakeDefault.bind(this);

    this.state = {
      cardholderName: null,
      loading: false,
      makeDefault: false
    }
  }

  onChangeCardHolderName(e) {
    this.setState({ cardholderName: e.target.value });
  }

  async onClickBack() {
    await Promise.all([
      this.props.actions.updateAlert(null, null),
      this.props.actions.updatePageNumber(PAGE.INFO)
    ]);
  }

  async handleSubmit(ev) {
    ev.preventDefault();
    const { cardholderName, makeDefault } = this.state;
    if (!cardholderName) {
      return;
    }
    this.setState({ loading: true });

    const { customer, subscription: { customer_id: customerId } } = this.props;
    const paymentMethod = await this.props.stripe.createPaymentMethod({
      type: 'card',
      card: this.props.elements.getElement('card'),
      billing_details: {
        email: customer.email,
        name: this.state.cardholderName,
        phone: customer.phone
      },
    });

    if (paymentMethod.error) {
      this.setState({ loading: false });
      return this.props.actions.updateAlert('danger', paymentMethod.error.message);
    }

    try {
      const { json: pm } = await SupersetClient.post({
        endpoint: `/billing/customers/${customerId}/cards`,
        postPayload: {
          payment_method_id: paymentMethod.paymentMethod.id,
          make_default: makeDefault
        },
        stringify: false,
      });

      this.props.actions.updateAlert('success', 'Successfully added card');
      window.location.reload();
    } catch (error) {
      this.props.actions.updateAlert('danger', 'Unable to add payment card. Please try again or contact our development team');
    }
    this.setState({ loading: false });
  }

  onMakeDefault() {
    this.setState({ makeDefault: !this.state.makeDefault });
  }

  getValidationNameCard() {
    const { cardholderName } = this.state;
    if (!this.state.cardholderName) {
      return INPUT_ERROR.ERROR;
    }
    return null;
  }

  render() {
    const { loading, makeDefault } = this.state;

    return (
      <form onSubmit={this.handleSubmit}>
        <FormGroup validationState={this.getValidationNameCard()}>
          <ControlLabel>Name on Card</ControlLabel>
          <FormControl
            type='text'
            value={this.state.cardholderName}
            onChange={this.onChangeCardHolderName}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>Credit Card</ControlLabel>
          <CardSection />
          <Checkbox checked={makeDefault} onChange={this.onMakeDefault}>Make Default</Checkbox>
        </FormGroup>
        <div className='contact-footer'>
          <Button bsStyle="primary" onClick={this.onClickBack}>BACK</Button>
          <Button bsStyle="primary" type="submit">{
            loading ? (<img src='/static/assets/images/loading-white.gif' />) : 'ADD'
          }</Button>
        </div>
      </form>
    )
  }
}

export default injectStripe(AddCardInput);
