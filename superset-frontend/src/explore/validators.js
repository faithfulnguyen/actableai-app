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
/* Reusable validator functions used in controls definitions
 *
 * validator functions receive the v and the configuration of the control
 * as arguments and return something that evals to false if v is valid,
 * and an error message if not valid.
 * */
import { t } from '@superset-ui/translation';

export function numeric(v) {
  if (v && isNaN(v)) {
    return t('should be a number');
  }
  return false;
}

export function integer(v) {
  if (v && (isNaN(v) || parseInt(v, 10) !== +v)) {
    return t('should be an integer');
  }
  return false;
}

export function nonEmpty(v) {
  if (
    v === null ||
    v === undefined ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  ) {
    return t('cannot be empty');
  }
  return false;
}

export function greater0(v) {
  if (v < 1) {
    return t('should be greater than 0');
  }
  return false;
}

export function from1to20(v) {
  if (v !== '' && (v < 1 || v > 20)) {
    return t('should be from 1 to 20');
  }
  return false;
}

export function from1to100(v) {
  if (v < 1 || v > 100) {
    return t('should be from 1 to 100');
  }
  return false;
}

export function isAutoOrNumGreater1(v) {
  if (v == "auto") return false;
  if (v && (isNaN(v) || (parseInt(v, 10) !== +v))) {
    return t('should be an integer or "auto"');
  }
  if (v <= 1) {
    return t("should be minimum 2");
  }
  return false;
}

