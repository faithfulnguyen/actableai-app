import React from 'react';
import { injectStripe } from 'react-stripe-elements';
import { SupersetClient } from '@superset-ui/connection';
import _ from 'lodash';
import { FormGroup, ControlLabel, FormControl, Button, Checkbox, Table, Tabs, Tab, Alert } from 'react-bootstrap';
import CardSection from './CardSection';
import Card from '../components/Card';
import { INTERVAL, CREDIT_CARD_CHOOSE, INPUT_ERROR, CYCLE_TYPE, PAGE, PROMO_STATUS } from '../constants/index';
import 'react-toastify/dist/ReactToastify.css';

class CheckoutForm extends React.Component {
  constructor(props) {
    super(props);
    this.onClickBack = this.onClickBack.bind(this);
    this.onChangeCardHolderName = this.onChangeCardHolderName.bind(this);
    this.onCheckPolicy = this.onCheckPolicy.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.onSelectCreditCard = this.onSelectCreditCard.bind(this);
    this.onChooseCreditCard = this.onChooseCreditCard.bind(this);
    this.renderPrice = this.renderPrice.bind(this);
    this.onChangePromotionCode = this.onChangePromotionCode.bind(this);
    this.applyPromotionCode = this.applyPromotionCode.bind(this);

    this.state = {
      total: 0,
      cardholderName: null,
      loading: false,
      checkPolicy: false,
      policyError: false,
      creditCardChoose: CREDIT_CARD_CHOOSE.CURRENT,
      defaultPaymentMethod: null,
      promo: {
        promotionCode: null,
        discountAmount: 0,
        status: null,
        message: '',
        promotionId: null
      }
    }
  }

  onChangeCardHolderName(e) {
    this.setState({ cardholderName: e.target.value });
  }

  onChangePromotionCode(e) {
    this.setState({ promo: { ...this.state.promo, promotionCode: e.target.value } });
  }

  async applyPromotionCode() {
    const { promo, total } = this.state;
    const { subscription } = this.props;
    if(promo.promotionCode) {
      const { json: code } = await SupersetClient.get({
        endpoint: `/billing/promotion-code/${promo.promotionCode}`
      });
  
      if (code.status && code.status === 'existed') {
        return this.setState({ promo: {
          ...this.state.promo,
          message: 'The promotion code is already used',
          status: PROMO_STATUS.FAILURE,
          discountAmount: 0
        }});
      }
  
      if (Object.keys(code).length && code?.data?.length) {
        const promoCode = code.data[0];
  
        if ((promoCode.restrictions.first_time_transaction && subscription.customer_id)
        || promoCode.restrictions.minimum_amount / 100 > total
        || (promoCode.customer && promoCode.customer != subscription.customer_id)) {
          return this.setState({ promo: {
            ...this.state.promo,
            message: 'Promo code cann\'t be applied to this order',
            status: PROMO_STATUS.FAILURE,
            discountAmount: 0
          }});
        }
  
        if (promoCode.coupon.percent_off) {
          this.setState({ promo: {
            ...this.state.promo,
            discountAmount: Math.round(total * (promoCode.coupon.percent_off / 10)) / 10
          }});
        }
        if (promoCode.coupon.amount_off) {
          this.setState({ promo: {
            ...this.state.promo,
            discountAmount: promoCode.coupon.amount_off / 100
          }});
        }
        return this.setState({ promo: {
          ...this.state.promo,
          message: 'Promo code has been applied',
          status: PROMO_STATUS.SUCCESS,
          promotionId: promoCode.id
        }});
      } else {
        this.setState({ promo: {
          ...this.state.promo,
          message: 'Promotion code is invalid or has expired',
          status: PROMO_STATUS.FAILURE,
          discountAmount: 0
        }});
      }
    }
    else {
      this.setState({ promo: {
        ...this.state.promo,
        message: 'Promotion code is required',
        status: PROMO_STATUS.FAILURE,
        discountAmount: 0
      }});
    }
    
  }

  async onClickBack() {
    await Promise.all([
      this.props.actions.updateAlert(null, null),
      this.props.actions.updatePageNumber(PAGE.CONTACT)
    ]);
  }

  onCheckPolicy() {
    this.setState({ checkPolicy: !this.state.checkPolicy, policyError: false });
  }

  async handleSubmit(ev) {
    ev.preventDefault();
    this.setState({ loading: true });
    await this.props.actions.updateAlert(null, null);
    const { info, subscription, choosePlan } = this.props;
    const { creditCardChoose } = this.state;
    let customerId;

    if (!(subscription && subscription.customer_id)) {
      if (!this.state.checkPolicy) {
        return this.setState({ loading: false, policyError: true });
      }

      const paymentMethod = await this.props.stripe.createPaymentMethod({
        type: 'card',
        card: this.props.elements.getElement('card'),
        billing_details: {
          email: info.email,
          name: this.state.cardholderName,
          phone: info.phone
        },
      });
      if (paymentMethod.error) {
        this.setState({ loading: false });
        return this.props.actions.updateAlert('danger', paymentMethod.error.message);
      }

      const jsonInfo = JSON.stringify(info);
      const { json: customer } = await SupersetClient.post({
        endpoint: '/billing/customers',
        postPayload: {
          payment_method: paymentMethod.paymentMethod.id,
          info: jsonInfo
        },
        stringify: false,
      });

      if (customer.customer.error) {
        this.setState({ loading: false });
        return this.props.actions.updateAlert('danger', customer.customer.error);
      }

      customerId = customer.customer.id;
      this.setState({ defaultPaymentMethod: paymentMethod.paymentMethod.id });
    } else {
      customerId = subscription.customer_id;
      if (creditCardChoose === CREDIT_CARD_CHOOSE.NEW) {
        if (!this.state.checkPolicy) {
          return this.setState({ loading: false, policyError: true });
        }

        const paymentMethod = await this.props.stripe.createPaymentMethod({
          type: 'card',
          card: this.props.elements.getElement('card'),
          billing_details: {
            email: info.email,
            name: this.state.cardholderName,
            phone: info.phone
          },
        });
        if (paymentMethod.error) {
          this.setState({ loading: false });
          return this.props.actions.updateAlert('danger', paymentMethod.error.message);
        }

        const { json: pm } = await SupersetClient.post({
          endpoint: `/billing/customers/${customerId}/cards`,
          postPayload: {
            payment_method_id: paymentMethod.paymentMethod.id,
            make_default: false
          },
          stringify: false,
        });

        this.setState({ defaultPaymentMethod: paymentMethod.paymentMethod.id });
      }

      const jsonInfo = JSON.stringify(info);
      await SupersetClient.put({
        endpoint: `/billing/customers/${customerId}`,
        postPayload: {
          info: jsonInfo
        },
        stringify: false,
      });
    }

    const { total, defaultPaymentMethod, promo } = this.state;
    const promoItem = promo.promotionId ? { promotionId: promo.promotionId } : {};

    const { json: subStripe } = await SupersetClient.post({
      endpoint: '/billing/subscription',
      postPayload: {
        customerId,
        priceId: choosePlan.priceId,
        default_payment_method: defaultPaymentMethod,
        ...promoItem
      },
      stringify: false,
    });

    const { status, id: subscriptionId, discount } = subStripe.subscription;

    if (status === 'active') {
      let monthlyPrice = choosePlan.cycleType === CYCLE_TYPE.MONTHLY ? total : Math.round(total / 1.2) / 10;
      if (discount && discount.coupon && discount.coupon.duration === 'forever') {
        monthlyPrice = choosePlan.cycleType === CYCLE_TYPE.MONTHLY ? total - promo.discountAmount : Math.round((total - promo.discountAmount) / 1.2) / 10;
      }

      await SupersetClient.put({
        endpoint: '/billing/customers/subscription',
        postPayload: {
          customer_id: customerId,
          plan_id: this.props.choosePlan.planId,
          subscription_id: subscriptionId,
          interval: choosePlan.cycleType,
          monthlyPrice,
          ...promoItem
        },
        stringify: false,
      });
      if (subscription && subscription.subscription_id) {
        await SupersetClient.delete({
          endpoint: `/billing/subscription/${subscription.subscription_id}`,
          stringify: false,
        });
      }
      await this.props.actions.updateAlert('success', 'Payment successfully');
      this.setState({ loading: false });
      window.location.reload();
    } else {
      await this.props.actions.updateAlert('danger', result.error.message);
    }
  };

  getValidationNameCard() {
    const { cardholderName } = this.state;
    if (!this.state.cardholderName) {
      return INPUT_ERROR.ERROR;
    }
    return null;
  }

  async componentDidMount() {
    const { choosePlan, plans, subscription, customer, cards } = this.props;
    const plan = _.find(plans, { id: choosePlan.planId });
    const customerId = subscription ? subscription.customer_id : null;

    if (customerId && cards.length) {
      this.setState({
        creditCardChoose: CREDIT_CARD_CHOOSE.CURRENT,
        defaultPaymentMethod: customer.invoice_settings.default_payment_method
      });
    } else {
      this.setState({ creditCardChoose: CREDIT_CARD_CHOOSE.NEW });
    }

    this.setState({ total: choosePlan.cycleType === CYCLE_TYPE.MONTHLY ? plan.price : plan.annual_price * 12 });
  }

  onSelectCreditCard(key) {
    this.setState({ creditCardChoose: key === 1 ? CREDIT_CARD_CHOOSE.CURRENT : CREDIT_CARD_CHOOSE.NEW });
  }

  onChooseCreditCard(card) {
    this.setState({ defaultPaymentMethod: card.id });
  }

  renderPrice(plan) {
    const { choosePlan } = this.props;
    if (choosePlan.cycleType === CYCLE_TYPE.MONTHLY) {
      return <span>${plan.price}/month</span>;
    }
    return <span>${plan.annual_price}/month x 12</span>
  }

  render() {
    const { loading, checkPolicy, policyError, total, defaultPaymentMethod, promo } = this.state;
    const { info, choosePlan, plans, subscription, cards, alert } = this.props;
    const plan = _.find(plans, { id: choosePlan.planId });
    const customerId = subscription ? subscription.customer_id : null;

    return (
      <form onSubmit={this.handleSubmit}>
        {alert.status && <Alert bsStyle={alert.status}>{alert.msg}</Alert>}
        <div className='row payment-body'>
          <div className='col-md-6'>
            <div className='credit-card-head'>
              <h4>Credit Card</h4>
              <div>
                <img src='/static/assets/images/visa.png' />
                <img src='/static/assets/images/mastercard.png' />
                <img src='/static/assets/images/american_express.png' />
              </div>
            </div>
            <Tabs id='credit-card' defaultActiveKey={customerId && cards.length ? 1 : 2} onSelect={this.onSelectCreditCard} animation>
              <Tab className="current-card" eventKey={1} title="Use current card" disabled={customerId && cards.length ? false : true}>
                {cards.length ? (
                  <div className='list-card'>{cards.map((card, i) => (
                    <Card
                      isDefault={card.id === defaultPaymentMethod}
                      card={card}
                      key={i}
                      isChoose
                      onChooseCreditCard={(card) => this.onChooseCreditCard(card)} />
                  ))}</div>
                ) : (
                  <img className='loading' src='/static/assets/images/loading.gif' />
                )}
              </Tab>
              <Tab eventKey={2} title="Enter New Card Information">
                <div>
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
                  </FormGroup>
                  <Checkbox checked={checkPolicy} className={policyError && 'text-error'} onChange={this.onCheckPolicy}>
                    I have read and agree to <a href='https://www.actable.ai/terms-and-conditions' target='_blank'>the terms of the End User License Agreement</a>. I agree to automatic monthly or yearly renewal according to the chosen plan. This order will be auto-renewed to avoid interruption to my ActableAI access, until I cancel.
                  </Checkbox>
                </div>
              </Tab>
            </Tabs>
          </div>
          <div className='col-md-3 billing-info'>
            <h4>Contact Info</h4>
            <p>{`${info.firstName} ${info.lastName}`}</p>
            <p>{info.company}</p>
            <p>{info.email}</p>
            <p>{info.phone}</p>
          </div>
          <div className='col-md-3 billing-info'>
            <h4>Billing Address</h4>
            <p>{info.billingAddress1}</p>
            <p>{`${info.billingCity}, ${info.billingZip}`}</p>
            <p>{info.billingCountry}</p>
          </div>
          <div className='col-md-12'>
            <h4>Promotion Code</h4>
            <div className='col-md-6 billing-promotion-code'>
              <div className='promo-input'>
                <FormControl
                  type='text'
                  value={this.state.promo.promotionCode}
                  onChange={this.onChangePromotionCode}
                />
                <Button bsStyle="primary" onClick={this.applyPromotionCode}>APPLY</Button>
              </div>
              <p className={promo.status}>{promo.message}</p>
            </div>
          </div>
          <div className='col-md-12'>
            <h3>Order Summary</h3>
            <Table>
              <thead>
                <tr>
                  <th></th>
                  <th>{choosePlan.cycleType === CYCLE_TYPE.MONTHLY ? 'Billed Monthly' : 'Billed Annually'}</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{plan.name} <br />{this.renderPrice(plan)}</td>
                  <td>{`$${total}`}</td>
                  <td>{`$${total}`}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td className='summary'>Subtotal<br />Discount<br />Total</td>
                  <td className='summary'>
                    {`$${total}`}
                    <br />
                    ${promo.discountAmount}
                    <br />
                    <span className='summaty-total'>{`$${total - promo.discountAmount}`}</span>
                  </td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </div>
        <div className='contact-footer'>
          <Button bsStyle="primary" onClick={this.onClickBack}>BACK</Button>
          <Button bsStyle="primary" type="submit">{
            loading ? (<img src='/static/assets/images/loading-white.gif' />) : 'COMPLETE YOUR PURCHASE'
          }</Button>
        </div>
      </form>
    );
  }
}

export default injectStripe(CheckoutForm);
