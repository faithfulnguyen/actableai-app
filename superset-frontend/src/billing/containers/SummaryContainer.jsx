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
import * as moment from 'moment';
import { SupersetClient } from '@superset-ui/connection';
import { Panel, Button, Table, Modal } from 'react-bootstrap';
import Card from '../components/Card';
import { TYPE_PLAN, PAGE, ANALYTICS, CYCLE_TYPE } from '../constants/index';

const propTypes = {};

export default class SummaryContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.calculateTime = this.calculateTime.bind(this);
    this.changePlan = this.changePlan.bind(this);
    this.handleCloseModalCancel = this.handleCloseModalCancel.bind(this);
    this.handleShowModalCancel = this.handleShowModalCancel.bind(this);
    this.handleCancelPlan = this.handleCancelPlan.bind(this);
    this.handleCloseModalCancelSuccess = this.handleCloseModalCancelSuccess.bind(this);
    this.goAddCardPage = this.goAddCardPage.bind(this);
    this.onShowDeleteCreditCard = this.onShowDeleteCreditCard.bind(this);
    this.handleCloseModalDelete = this.handleCloseModalDelete.bind(this);
    this.handleDeleteCreditCard = this.handleDeleteCreditCard.bind(this);
    this.formatTime = this.formatTime.bind(this);

    this.state = {
      showModalCancel: false,
      showModalCancelSuccess: false,
      showModalDelete: false,
      loadingBtn: false,
      loadingCards: true,
      loadingInvoices: true,
      loadingBalanceHistory: true,
      deleteCardId: null,
      cycleType: CYCLE_TYPE.MONTHLY
    };
  }

  async componentDidMount() {
    const { customer_id: customerId, subscription_id } = this.props.subscription;

    if (customerId) {
      const [
        { json: cards },
        { json: customer },
        { json: subscription },
        { json: invoices },
        { json: balance_history }
      ] = await Promise.all([
        SupersetClient.get({
          endpoint: `/billing/customers/${customerId}/cards`
        }),
        SupersetClient.get({
          endpoint: `/billing/customers/${customerId}`
        }),
        SupersetClient.get({
          endpoint: `/billing/subscription/${subscription_id}`
        }),
        SupersetClient.get({
          endpoint: `/billing/customers/${customerId}/invoices`
        }),
        SupersetClient.get({
          endpoint: `/billing/balance-history`
        })
      ]);

      this.props.actions.updateAttributes({
        cards: cards.cards,
        customer: customer.customer,
        invoices: invoices.invoices,
        balanceHistory: balance_history.balance_history
      });
      this.setState({
        loadingCards: false,
        loadingInvoices: false,
        cycleType: subscription.items.data[0].plan.interval,
        loadingBalanceHistory: false
      });
    }
  }

  calculateTime(seconds) {
    const { subscription, plans } = this.props;
    const plan = _.find(plans, { id: subscription.stripe_product_id });
    
    if (plan?.type === TYPE_PLAN.USAGE_UNLIMITED) {
      return '';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds - 3600 * hours) / 60);
    return `Available time: ${hours}h ${minutes}m ${seconds - 3600 * hours - 60 * minutes}s`;
  }

  formatTime(seconds) {
    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds - 3600 * hh) / 60);
    const ss = seconds - 3600 * hh - 60 * mm;
    const hf = hh ? `${hh}h ` : '';
    const mf = mm ? `${mm}m ` : '';
    const sf = ss || ss;
    return `${hf}${mf}${sf}s`;
  }

  changePlan() {
    this.props.actions.updatePageNumber(PAGE.PLAN_LIST);
  }

  handleCloseModalCancel() {
    this.setState({ showModalCancel: false, loadingBtn: false });
  }

  handleShowModalCancel() {
    this.setState({ showModalCancel: true });
  }

  async handleCancelPlan() {
    this.setState({ loadingBtn: true });
    const { subscription } = this.props;
    if (subscription && subscription.subscription_id) {
      await SupersetClient.delete({
        endpoint: `/billing/subscription/${subscription.subscription_id}/cancel`,
        stringify: false,
      });
    }
    this.setState({ showModalCancelSuccess: true, showModalCancel: false });
  }

  handleCloseModalCancelSuccess() {
    this.setState({ showModalCancelSuccess: false });
    window.location.reload();
  }

  async goAddCardPage() {
    await this.props.actions.updatePageNumber(PAGE.ADD_CARD);
  }

  handleCloseModalDelete() {
    this.setState({ showModalDelete: false, deleteCardId: null });
  }

  onShowDeleteCreditCard(card) {
    this.setState({ deleteCardId: card.id, showModalDelete: true });
  }

  async handleDeleteCreditCard() {
    this.setState({ loadingBtn: true });
    const { deleteCardId } = this.state;
    const { cards } = this.props;
    const { json: card } = await SupersetClient.delete({
      endpoint: `/billing/cards/${deleteCardId}`,
      stringify: false,
    });

    _.remove(cards, { id: card.id });
    await this.props.actions.updateAttribute('cards', cards);
    this.setState({ showModalDelete: false, deleteCardId: null, loadingBtn: false });
  }

  render() {
    const { subscription, plans, cards, customer, invoices, balanceHistory } = this.props;
    const { loadingBtn, loadingCards, cycleType, loadingInvoices, loadingBalanceHistory } = this.state;
    const plan = _.find(plans, { id: subscription.stripe_product_id });

    return (
      <div id='summary'>
        <Panel className='billed-monthly'>
          <Panel.Heading>
            <Panel.Title>{<h4>Current Plan</h4>}</Panel.Title>
          </Panel.Heading>
          {!subscription.end_time || moment(subscription.end_time).format('MM-DD-YYYY HH:mm') >= moment().format('MM-DD-YYYY HH:mm') ? (
            <div className='details'>
              <div>
                <p>Name: {plan?.name}</p>
                <p>Price: ${subscription.monthly_price}/month</p>
                {subscription.due_time ? (
                  <p>Next payment period: {moment(subscription.due_time).format('MM-DD-YYYY HH:mm')}</p>
                ) : (
                  <p>Expiration date: {moment(subscription.end_time).format('MM-DD-YYYY HH:mm')}</p>
                )}
              </div>
              <div className='btn-group'>
                <Button onClick={this.changePlan} bsStyle="primary">Change plan</Button>
                {subscription.due_time && <Button name="cancel" onClick={this.handleShowModalCancel} bsStyle="danger">Cancel plan</Button>}
              </div>
            </div>
          ) : (
            <div className='details'>
              <p>There are no active plans</p>
              <Button onClick={this.changePlan} bsStyle="primary">Choose plan</Button>
            </div>
          )}
        </Panel>
        <Panel className='available-time'>
          <Panel.Heading>
            <Panel.Title>{<h4>Time Tracking</h4>}</Panel.Title>
          </Panel.Heading>
          <div className='details'>
            <p>{this.calculateTime(subscription.billing_available_time)}</p>
          </div>
          <Table className='tracking-table'>
            <thead>
              <tr>
                <th>Date</th>
                <th>Analytic</th>
                <th>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {balanceHistory.map((item, i) => (
                <tr key={i}>
                  <td>{moment(item.create_time).format('MM-DD-YYYY HH:mm')}</td>
                  <td>{ANALYTICS[item.viz_type]}</td>
                  <td>{this.formatTime(item.number_of_seconds)}</td>
                </tr>
              ))}
            </tbody>
            {loadingBalanceHistory && balanceHistory.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan='3'><img className='loading' src='/static/assets/images/loading.gif' /></td>
                </tr>
              </tfoot>
            )}
          </Table>
        </Panel>
        {subscription.customer_id && (
          <div>
            <Panel className='payment-methods'>
              <Panel.Heading>
                <Panel.Title>{<h4>Payment methods</h4>}</Panel.Title>
              </Panel.Heading>
              <p>Please enter your preferred payment method below. You can use a credit / debit card.</p>
              <div className='card-body'>
                <div className='card-title'>
                  <div>
                    <h5>Credit / Debit Card</h5>
                    <p>Card will be charged monthly for resources used.<br />All major credit / debit cards accepted.</p>
                  </div>
                  <Button bsStyle="primary" onClick={this.goAddCardPage}>Add Card</Button>
                </div>
                <div className='list-card'>
                  {loadingCards && !cards.length && (<img className='loading' src='/static/assets/images/loading.gif' />)}
                  {cards.map((card, i) => (
                    <Card isDelete onShowDeleteCreditCard={(card) => this.onShowDeleteCreditCard(card)} card={card} key={i} />
                  ))}
                </div>
              </div>
            </Panel>
            <Panel className='billing-settings'>
              <Panel.Heading>
                <Panel.Title>{<h4>Billing Settings</h4>}</Panel.Title>
              </Panel.Heading>
              <h5>Address</h5>
              <p>This address appears on your monthly invoice and should be the legal address of your home or business</p>
              {customer ? (
                <div className='address-body'>
                  <div>
                    <p>{customer.address.line1}</p>
                    <p>{`${customer.address.city} - ${customer.address.postal_code}`}</p>
                    <p>{customer.address.country}</p>
                  </div>
                </div>
              ) : (
                <div className='address-body'><img className='loading' src='/static/assets/images/loading.gif' /></div>
              )}
            </Panel>
            <Panel className='billing-history'>
              <Panel.Heading>
                <Panel.Title>{<h4>Billing history</h4>}</Panel.Title>
              </Panel.Heading>
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, i) => (
                    <tr key={i}>
                      <td>{moment.unix(invoice.created).format('MM-DD-YYYY HH:mm')}</td>
                      <td>{invoice.description}</td>
                      <td>{`$${invoice.amount / 100}`}</td>
                      <td>{invoice.status}</td>
                      <td><a href={invoice.url} target='_blank'>View</a></td>
                    </tr>
                  ))}
                </tbody>
                {loadingInvoices && !invoices.length && (
                  <tfoot>
                    <tr>
                      <td colSpan='3'><img className='loading' src='/static/assets/images/loading.gif' /></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </Panel>
            <Modal show={this.state.showModalCancel} onHide={this.handleCloseModalCancel}>
              <Modal.Header closeButton>
                <Modal.Title>Cancel Plan</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>Are you sure you want to cancel your plan? This will cancel auto-renew and you can still use the plan until it ends.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button onClick={this.handleCloseModalCancel}>Cancel</Button>
                <Button onClick={this.handleCancelPlan} bsStyle="primary">{loadingBtn ? (<img src='/static/assets/images/loading-white.gif' />) : 'Oke'}</Button>
              </Modal.Footer>
            </Modal>
            <Modal show={this.state.showModalCancelSuccess} onHide={this.handleCloseModalCancelSuccess}>
              <Modal.Header closeButton>
                <Modal.Title>Successfully cancelled</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>You have successfully cancelled this payment schedule.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button onClick={this.handleCloseModalCancelSuccess}>Cancel</Button>
                <Button onClick={this.handleCloseModalCancelSuccess} bsStyle="primary">Oke</Button>
              </Modal.Footer>
            </Modal>
            <Modal show={this.state.showModalDelete} onHide={this.handleCloseModalDelete}>
              <Modal.Header closeButton>
                <Modal.Title>Delete credit card</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>Are you sure you want to delete your credit card?</p>
              </Modal.Body>
              <Modal.Footer>
                <Button onClick={this.handleCloseModalDelete}>Cancel</Button>
                <Button onClick={this.handleDeleteCreditCard} bsStyle="danger">{loadingBtn ? (<img src='/static/assets/images/loading-white.gif' />) : 'Delete'}</Button>
              </Modal.Footer>
            </Modal>
          </div>
        )}
      </div>
    )
  }
}

SummaryContainer.propTypes = propTypes;
