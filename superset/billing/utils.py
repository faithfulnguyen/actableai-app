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
from asyncio.log import logger
import datetime
from flask import g
from dateutil.relativedelta import relativedelta
from superset import app, db, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.custom import (
    TypeSubscription,
    BillingSubscription,
    RenewSubscription,
    BillingBalanceHistory
)
from sqlalchemy import or_
from superset.utils.stripe import Stripe


def activate_trial(user_id):
    subscription = get_subscription_nearest_by_user_id(user_id)
    if subscription is None and is_enabled_billing() \
            and is_enabled_trial_billing():
        stripe = Stripe()
        products = stripe.get_products()
        product = [p for p in products
                   if p.metadata.type == TypeSubscription.USAGE_TRIAL.name]
        subscription = BillingSubscription(
            user_id=user_id,
            type=TypeSubscription.USAGE_TRIAL,
            renew=RenewSubscription.UNACTIVATED,
            end_time=(datetime.datetime.now() + relativedelta(days=app.config.get("BILLING_TRIAL_DAY"))),
            stripe_product_id=product[0].id,
            billing_available_time=int(
                product[0].metadata.number_of_hours) * 60 * 60
        )
        db.session.add(subscription)
        db.session.commit()


def is_enabled_billing():
    return app.config["BILLING_FEATURE"] == "true"


def is_enabled_trial_billing():
    return app.config["BILLING_TRIAL_FEATURE"] == "true"


def allow_to_run_analytics(viz_type, datasource_id, datasource_type):
    datasource = ConnectorRegistry.get_datasource(
        datasource_type, datasource_id, db.session
    )
    if datasource_type == "table" and datasource.free_to_run_analytics:
        return True
    
    if viz_type in app.config.get("BILLING_ANALYTICS_CHECK_PAYMENT"):
        subscription = get_current_user_subscription()
        if not subscription or (subscription.billing_available_time <= 0 and
           subscription.type != TypeSubscription.USAGE_UNLIMITED):
            return False

    return True


def get_current_user_subscription():
    user_id = g.user.get_id()
    activate_trial(user_id)
    return get_current_subscription_of_user(user_id)


def get_current_subscription_of_user(user_id):
    return db.session.query(
        BillingSubscription).filter(
        BillingSubscription.user_id == user_id,
        or_(
            BillingSubscription.end_time.is_(None),
            BillingSubscription.end_time >= datetime.datetime.now()
        )
    ).first()


def get_subscription_nearest():
    user_id = g.user.get_id()
    activate_trial(user_id)
    return get_subscription_nearest_by_user_id(user_id)


def get_subscription_nearest_by_user_id(user_id):
    return db.session.query(
        BillingSubscription).filter(
        BillingSubscription.user_id == user_id,
    ).order_by(BillingSubscription.id.desc()).first()


def get_subscription_by_stripe_subscription_id(stripe_subsctiption_id):
    return db.session.query(
        BillingSubscription).filter_by(
            stripe_subscription_id=stripe_subsctiption_id).first()


def add_billing_balance_history(user_id, type_viz, runtime, table_datasource):
    if table_datasource.free_to_run_analytics:
        return
    
    if is_enabled_billing():
        balance_history = BillingBalanceHistory(
            user_id=user_id,
            viz_type=type_viz,
            number_of_seconds=round(runtime)
        )
        db.session.add(balance_history)

        subscription = get_current_subscription_of_user(user_id)
        if subscription and subscription.type != TypeSubscription.USAGE_UNLIMITED:
            db.session.query(
                BillingSubscription).filter(
                BillingSubscription.user_id == user_id,
                or_(
                    BillingSubscription.end_time.is_(None),
                    BillingSubscription.end_time >= datetime.datetime.now()
                )
            ).update({
                BillingSubscription.billing_available_time:
                BillingSubscription.billing_available_time - round(runtime)},
                synchronize_session=False)
        db.session.commit()
