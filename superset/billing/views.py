# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import datetime
from flask_appbuilder.security.decorators import has_access
from flask_appbuilder.api import expose
from flask import g, request
import simplejson as json
from dateutil.relativedelta import relativedelta
from superset import app, db
from superset.views.base import BaseSupersetView
from superset.models.custom import (
    BillingSubscription,
    BillingBalanceHistory,
    RenewSubscription,
    IntervalPlan,
    BillingPromoHistory
)
from superset.utils.stripe import Stripe
from superset.billing.utils import (
    get_current_user_subscription,
    get_subscription_nearest,
    get_subscription_by_stripe_subscription_id
)
from superset.views.base import json_error_response


class BillingView(BaseSupersetView):
    route_base = "/billing"

    def myconverter(self, o):
        if isinstance(o, datetime.datetime):
            return o.__str__()

    @has_access
    @expose('/')
    def index(self):
        apiKey = app.config.get("STRIPE_PUBLISHABLE_KEY")
        subscription = get_subscription_nearest()
        if subscription:
            subscription = {
                "billing_available_time": subscription.billing_available_time,
                "due_time": subscription.due_time,
                "end_time": subscription.end_time,
                "stripe_product_id": subscription.stripe_product_id,
                "customer_id": subscription.stripe_customer_id,
                "subscription_id": subscription.stripe_subscription_id,
                "monthly_price": subscription.monthly_price,
                "renew": subscription.renew
            }

        stripe = Stripe()
        arr_products = stripe.get_products()
        arr_prices = stripe.get_prices()

        plans = []
        for product in arr_products:
            prices = [p for p in arr_prices["data"]
                      if p["product"] == product.id]
            price_item = [x for x in prices if x["recurring"]
                          ["interval"] == "month"]
            annual_price_item = [
                x for x in prices if x["recurring"]["interval"] == "year"]
            plans.append({
                "id": product.id,
                "name": product.name,
                "price": price_item[0].unit_amount / 100
                if len(price_item) else 0,
                "type": product.metadata.type,
                "number_of_hours": product.metadata.number_of_hours,
                "annual_price": annual_price_item[0].unit_amount / 1200
                if len(annual_price_item) else 0,
                "description": product.metadata.description,
                "price_id": price_item[0].id if len(price_item) else None,
                "annual_price_id": annual_price_item[0].id
                if len(price_item) else None,
                "is_active": product.metadata.is_active if hasattr(product.metadata, 'is_active') else False
            })

        user = {
            "firstName": g.user.first_name,
            "lastName": g.user.last_name,
            "email": g.user.email
        }
        return self.render_template(
            "superset/basic.html",
            bootstrap_data=json.dumps(
                {"apiKey": apiKey, "user": user, "plans": plans,
                 "subscription": subscription
                 }, default=self.myconverter),
            entry="billing",
            title="Billing")

    @has_access
    @expose('/balance-history')
    def get_balance_history(self):
        balance_history = db.session.query(BillingBalanceHistory).filter_by(
            user_id=g.user.get_id()
        ).order_by(BillingBalanceHistory.create_time.desc()).limit(10).all()
        balance_history = [{
            "viz_type": e.viz_type,
            "create_time": e.create_time,
            "number_of_seconds": e.number_of_seconds
        } for e in balance_history]
        return json.dumps({"balance_history": balance_history},
                          default=self.myconverter)

    @has_access
    @expose('/plan', methods=['POST'])
    def createPlan(self):
        stripe = Stripe()
        amount = request.form["amount"]
        interval = request.form["interval"]
        app_name = app.config.get("APP_NAME")
        plan = stripe.createPlan(
            "{} access".format(app_name), amount, interval)
        return json.dumps({"plan": plan})

    @has_access
    @expose('/customers/<customer_id>')
    def getCustomer(self, customer_id):
        stripe = Stripe()
        customer = stripe.getCustomer(customer_id)
        return json.dumps({"customer": customer})

    @has_access
    @expose('/customers', methods=['POST'])
    def createCustomer(self):
        stripe = Stripe()
        data = request.form
        customer = stripe.createCustomer(data["info"], data["payment_method"])
        return json.dumps({"customer": customer})

    @has_access
    @expose('/customers/<customer_id>', methods=['PUT'])
    def updateCustomerStripe(self, customer_id):
        stripe = Stripe()
        data = request.form
        info = json.loads(data["info"])
        customer = stripe.updateCustomer(
            customer_id,
            name="{} {}".format(info["firstName"], info["lastName"]),
            email=info["email"],
            address={
                "line1": info["billingAddress1"],
                "city": info["billingCity"],
                "country": info["billingCountry"],
                "line2": info["billingAddress2"],
                "postal_code": info["billingZip"],
                "state": info["billingState"]
            },
            phone=info["phone"]
        )
        return json.dumps({"customer": customer})

    @has_access
    @expose('/customers/subscription', methods=['PUT'])
    def updateCustomer(self):
        data = request.form
        c_billing_available_time = 0
        c_subscription = get_current_user_subscription()
        if c_subscription:
            c_billing_available_time = c_subscription.billing_available_time
            c_subscription.end_time = datetime.datetime.now()
            c_subscription.renew = RenewSubscription.UNACTIVATED
        stripe = Stripe()
        product = stripe.retrieve_product(data["plan_id"])
        interval = data["interval"]
        billing_available_time = int(product.metadata.number_of_hours) * 60 * \
            60 if interval == IntervalPlan.MONTH.value \
            else int(product.metadata.number_of_hours) * 60 * 60 * 12
        due_time = datetime.datetime.now() + relativedelta(
            months=1) if interval == IntervalPlan.MONTH.value \
            else datetime.datetime.now() + relativedelta(years=1)
        subscription = BillingSubscription(
            user_id=g.user.get_id(),
            stripe_customer_id=data["customer_id"],
            stripe_subscription_id=data["subscription_id"],
            stripe_product_id=data["plan_id"],
            billing_available_time=billing_available_time +
            c_billing_available_time,
            due_time=due_time,
            monthly_price=data["monthlyPrice"],
            type=product.metadata.type
        )
        db.session.add(subscription)
        db.session.commit()
        if 'promotionId' in data:
            promo_history = BillingPromoHistory(
                user_id=g.user.get_id(),
                promo_id=data["promotionId"],
                subscription_id=subscription.id
            )
            db.session.add(promo_history)
            db.session.commit()
        return json.dumps({"subscription_id": subscription.id})

    @has_access
    @expose('/customers/<customer_id>/cards')
    def listCards(self, customer_id):
        stripe = Stripe()
        cards = stripe.listCards(customer_id)
        return json.dumps({"cards": cards["data"]})

    @has_access
    @expose('/customers/<customer_id>/cards', methods=['POST'])
    def add_card_to_customer(self, customer_id):
        data = request.form
        stripe = Stripe()
        pm = stripe.add_card_to_customer(
            customer_id, data["payment_method_id"])

        if data["make_default"]:
            stripe.updateCustomer(customer_id, invoice_settings={
                                  "default_payment_method": pm["id"]})
        return json.dumps({"pm": pm})

    @has_access
    @expose('/customers/<customer_id>/address')
    def getAddress(self, customer_id):
        stripe = Stripe()
        customer = stripe.getCustomer(customer_id)
        return json.dumps({"address": customer.address})

    @has_access
    @expose('/subscription', methods=['POST'])
    def createSubscription(self):
        stripe = Stripe()
        data = request.form
        promotion_id = data["promotionId"] if "promotionId" in data else None
        subscription = stripe.createSubscription(
            data["customerId"], data["priceId"],
            data["default_payment_method"], promotion_id)
        return json.dumps({"subscription": subscription})

    @has_access
    @expose('/subscription/<sub_id>', methods=['DELETE'])
    def deleteSubscription(self, sub_id):
        stripe = Stripe()
        subscription = stripe.cancelSubscription(sub_id)
        db.session.query(
            BillingSubscription).filter_by(
                stripe_subscription_id=sub_id
        ).update({
            BillingSubscription.billing_available_time: 0,
            BillingSubscription.renew: RenewSubscription.UNACTIVATED,
            BillingSubscription.end_time: datetime.datetime.now(),
            BillingSubscription.due_time: None
        }, synchronize_session=False)
        db.session.commit()
        return json.dumps({"subscription": subscription})

    @has_access
    @expose('/subscription/<sub_id>/cancel', methods=['DELETE'])
    def cancelSubscription(self, sub_id):
        stripe = Stripe()
        subscription = stripe.cancelSubscription(sub_id)
        db.session.query(
            BillingSubscription).filter_by(
                stripe_subscription_id=sub_id
        ).update({
            BillingSubscription.renew: RenewSubscription.UNACTIVATED,
            BillingSubscription.end_time: BillingSubscription.due_time,
            BillingSubscription.due_time: None
        }, synchronize_session=False)
        db.session.commit()
        return json.dumps({"subscription": subscription})

    @has_access
    @expose('/customers/<customer_id>/payment-intents')
    def getPaymentIntents(self, customer_id):
        stripe = Stripe()
        payment_intents = stripe.getPaymentIntents(customer_id)
        list_payment_intents = []
        for payment_intent in payment_intents.data:
            list_payment_intents.append({
                "created": payment_intent.created,
                "description": payment_intent.description,
                "amount": payment_intent.amount
            })
        return json.dumps({"payment_intents": list_payment_intents})

    @has_access
    @expose('/customers/<customer_id>/invoices')
    def get_invoices(self, customer_id):
        stripe = Stripe()
        invoices = stripe.get_list_invoices(customer_id)
        list_invoices = []
        for invoice in invoices.data:
            list_invoices.append({
                "created": invoice.created,
                "description": invoice.description,
                "amount": invoice.total,
                "status": invoice.status,
                "url": invoice.hosted_invoice_url
            })
        return json.dumps({"invoices": list_invoices})

    @has_access
    @expose('/cards/<card_id>', methods=['DELETE'])
    def delete_card(self, card_id):
        stripe = Stripe()
        return stripe.delete_card(card_id)

    @has_access
    @expose('/subscription/<sub_id>')
    def get_subscription(self, sub_id):
        stripe = Stripe()
        return stripe.retrieveSubscription(sub_id)

    @has_access
    @expose('/promotion-code/<promo_code>')
    def get_promo(self, promo_code):
        stripe = Stripe()
        promo = stripe.get_promo(promo_code)
        return json.dumps(promo)

    # Docs: https://github.com/stripe-samples/subscription-use-cases/blob/master/fixed-price-subscriptions/server/python/server.py
    @expose('/webhook', methods=['POST'])
    def webhook_received(self):
        stripe = Stripe()
        webhook_secret = app.config.get('STRIPE_WEBHOOK_SECRET')
        signature = request.headers.get('stripe-signature')
        event = None

        try:
            event = stripe.construct_event(
                request.data, signature, webhook_secret)
            data = event['data']
        except Exception:
            return json_error_response('Invalid signature', status=400)

        data_object = data['object']

        if event.type == 'invoice.payment_succeeded':
            if data_object['billing_reason'] == 'subscription_cycle':
                subscription_id = data_object['subscription']
                subscription = get_subscription_by_stripe_subscription_id(
                    subscription_id)
                if subscription:
                    product = stripe.retrieve_product(
                        subscription.stripe_product_id)
                    interval = data_object['lines']['data'][0]['price']['recurring']['interval']
                    billing_available_time = int(product.metadata.number_of_hours) * \
                        60 * 60 if interval == IntervalPlan.MONTH.value \
                        else int(product.metadata.number_of_hours) * 60 * 60 * 12
                    subscription.due_time += relativedelta(
                        months=1) if interval == IntervalPlan.MONTH.value \
                        else relativedelta(years=1)
                    subscription.billing_available_time += billing_available_time
                    db.session.commit()

        elif event.type == 'customer.subscription.deleted':
            subscription_id = data_object['items']['data'][0]['subscription']
            db.session.query(
                BillingSubscription).filter_by(
                stripe_subscription_id=subscription_id,
                renew=RenewSubscription.ACTIVATED
            ).update({
                BillingSubscription.renew: RenewSubscription.UNACTIVATED,
                BillingSubscription.billing_available_time: 0,
                BillingSubscription.end_time: datetime.datetime.now(),
                BillingSubscription.due_time: None
            }, synchronize_session=False)
            db.session.commit()

        return json.dumps({'status': 'success'})
