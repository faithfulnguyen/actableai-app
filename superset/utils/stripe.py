from superset import app
from superset.models import custom as modelsCustom
import stripe
import json


class Stripe(object):
    def __init__(self):
        self.stripe = stripe
        self.stripe.api_key = app.config.get("STRIPE_SECRET_KEY")

    def createPlan(self, product_name, amount, interval, currency="usd"):
        return self.stripe.Plan.create(
            amount=int(float(amount) * 100),
            currency=currency,
            interval=interval,
            product={"name": product_name},
        )

    def createCustomer(self, info, payment_method):
        try:
            info = json.loads(info)
            return self.stripe.Customer.create(
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
                phone=info["phone"],
                payment_method=payment_method,
                invoice_settings={"default_payment_method": payment_method}
            )
        except stripe.error.CardError as e:
            return {"error": e.error.message}

    def listCards(self, customer_id):
        return self.stripe.PaymentMethod.list(
            customer=customer_id,
            type="card",
        )

    def createSubscription(self, customer_id, price_id, default_payment_method=None, promotion_id=None):
        return self.stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            promotion_code=promotion_id,
            default_payment_method=default_payment_method
        )

    def retrieveSubscription(self, sub_id):
        return self.stripe.Subscription.retrieve(sub_id)

    def cancelSubscription(self, sub_id):
        subscription = self.retrieveSubscription(sub_id)
        if subscription and subscription.status == "active":
            return self.stripe.Subscription.delete(sub_id)
        return subscription

    def getCustomer(self, customer_id):
        return self.stripe.Customer.retrieve(customer_id)

    def getPaymentIntents(self, customer_id):
        return self.stripe.PaymentIntent.list(customer=customer_id)

    def add_card_to_customer(self, customer_id, payment_method_id):
        return self.stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)

    def updateCustomer(self, customer_id, **kwargs):
        return self.stripe.Customer.modify(customer_id, **kwargs)

    def delete_card(self, payment_method_id):
        return self.stripe.PaymentMethod.detach(payment_method_id)

    def get_products(self):
        return self.stripe.Product.list(active=True)

    def retrieve_product(self, product_id):
        return self.stripe.Product.retrieve(product_id)

    def get_prices(self):
        return self.stripe.Price.list(active=True, limit=20)

    def get_promo(self, promo_code):
        return self.stripe.PromotionCode.list(code=promo_code, active=True)

    def construct_event(self, payload, sig_header, webhook_secret):
        return stripe.Webhook.construct_event(
            payload=payload, sig_header=sig_header, secret=webhook_secret)

    def retrieve_payment_intent(self, payment_intent_id):
        return self.stripe.PaymentIntent.retrieve(payment_intent_id)

    def update_subscription(self, subscription_id, **kwargs):
        return self.stripe.Subscription.modify(subscription_id, **kwargs)

    def get_list_invoices(self, customer_id):
        return self.stripe.Invoice.list(customer=customer_id)
