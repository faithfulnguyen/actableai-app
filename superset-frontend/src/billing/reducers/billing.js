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
/* eslint camelcase: 0 */
import _ from 'lodash';
import * as actions from '../actions/index';
import { CYCLE_TYPE } from '../constants/index';

export default function mappingReducer(state = {}, action) {
  const actionHandlers = {
    [actions.CHOOSE_PLAN]() {
      const { choosePlan, plans } = state;
      const plan = _.find(plans, { id: action.planId });

      if (choosePlan.cycleType === CYCLE_TYPE.MONTHLY) {
        choosePlan.priceId = plan.price_id;
      } else {
        choosePlan.priceId = plan.annual_price_id;
      }
      choosePlan.planId = action.planId;
      return { ...state, choosePlan };
    },
    [actions.SWICH_CYCLE]() {
      const { choosePlan } = state;
      choosePlan.cycleType = action.cycleType;
      return { ...state, choosePlan };
    },
    [actions.UPDATE_PAGE_NUMBER]() {
      return { ...state, page: action.page };
    },
    [actions.UPDATE_INFO]() {
      const { info } = state;
      info[action.source] = action.value;
      return { ...state, info };
    },
    [actions.UPDATE_INFOS]() {
      const { info } = state;
      const { object } = action;
      Object.keys(object).forEach((key) => {
        if (object[key] === null) {
          info[key] = '';
        } else {
          info[key] = object[key];
        }
      });
      return { ...state, info };
    },
    [actions.UPDATE_ALERT]() {
      return { ...state, alert: { status: action.status, msg: action.msg } };
    },
    [actions.UPDATE_ATTRIBUTE]() {
      return { ...state, [action.source]: action.value };
    },
    [actions.UPDATE_ATTRIBUTES]() {
      const { value } = action;
      const attributes = {};
      Object.keys(value).forEach((attribute) => {
        attributes[attribute] = value[attribute];
      });
      return { ...state, ...attributes };
    }
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
