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
import { SupersetClient } from '@superset-ui/connection';

export const CHOOSE_PLAN = 'CHOOSE_PLAN';
export function choosePlan(planId) {
  return { type: CHOOSE_PLAN, planId };
}

export const SWICH_CYCLE = 'SWICH_CYCLE';
export function switchCycle(cycleType) {
  return { type: SWICH_CYCLE, cycleType };
}

export const UPDATE_PAGE_NUMBER = 'UPDATE_PAGE_NUMBER';
export function updatePageNumber(page) {
  return { type: UPDATE_PAGE_NUMBER, page };
}

export const UPDATE_INFO = 'UPDATE_INFO';
export function updateInfo(source, value) {
  return { type: UPDATE_INFO, source, value };
}

export const UPDATE_INFOS = 'UPDATE_INFOS';
export function updateInfos(object) {
  return { type: UPDATE_INFOS, object };
}

export const UPDATE_ALERT = 'UPDATE_ALERT';
export function updateAlert(status, msg) {
  return { type: UPDATE_ALERT, status, msg };
}

export const UPDATE_ATTRIBUTE = 'UPDATE_ATTRIBUTE';
export function updateAttribute(source, value) {
  return { type: UPDATE_ATTRIBUTE, source, value };
}

export const UPDATE_ATTRIBUTES = 'UPDATE_ATTRIBUTES';
export function updateAttributes(value) {
  return { type: UPDATE_ATTRIBUTES, value };
}
