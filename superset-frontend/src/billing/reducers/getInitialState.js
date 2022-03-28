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
import _ from 'lodash';
import { TYPE_PLAN, CYCLE_TYPE, PAGE } from '../constants/index';

export default function getInitialState(bootstrapData) {
  const infoState = {
    phone: '',
    billingCountry: '',
    billingAddress1: '',
    billingAddress2: '',
    billingState: '',
    billingCity: '',
    billingZip: ''
  };

  const plans = bootstrapData.plans.push({
    name: 'Need more?',
    type: TYPE_PLAN.CONTACT_US,
    price: 'Contact us for',
    annual_price: 'Contact us for',
    number_of_hours: 0,
    description: 'Get in touch. We’d love to chat!'
  })

  return {
    billing: {
      ...bootstrapData,
      page: bootstrapData.subscription != null ? PAGE.INFO : PAGE.PLAN_LIST,
      choosePlan: {
        cycleType: CYCLE_TYPE.ANNUALLY,
        planId: 10,
        priceId: null
      },
      info: _.assign(infoState, bootstrapData.user),
      alert: {
        status: null,
        msg: null
      },
      customer: null,
      invoices: [],
      cards: [],
      balanceHistory: []
    }
  }
}
