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
import { PAGE } from '../constants/index';

const propTypes = {};

export default class StepBar extends React.PureComponent {
  render() {
    const { page, infoPage } = this.props;
    return (
      <div>
        {infoPage.indexOf(page) === -1 && (
          <div className='step-bar'>
            <span className={page === PAGE.PLAN_LIST ? 'step-active' : undefined}>1. Choose plan</span>
            <i className="fa fa-angle-right"></i>
            <span className={page === PAGE.CONTACT ? 'step-active' : undefined}>2. Contact & billing</span>
            <i className="fa fa-angle-right"></i>
            <span className={page === PAGE.PAYMENT ? 'step-active' : undefined}>3. Summary & Payment</span>
          </div>
        )}
      </div>
    );
  }
}

StepBar.propTypes = propTypes;
