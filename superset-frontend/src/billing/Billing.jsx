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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import * as billingActions from './actions/index';
import CustomizeContainer from './containers/CustomizeContainer';
import PaymentContainer from './containers/PaymentContainer';
import StepBar from './containers/StepBar';
import ContactContainer from './containers/ContactContainer';
import SummaryContainer from './containers/SummaryContainer';
import AddCard from './containers/AddCard';
import { PAGE } from './constants/index';

const propTypes = {};

class Billing extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const { plans, page } = this.props;
    const infoPage = [PAGE.INFO, PAGE.ADD_CARD];

    return (
      <div>
        <Panel id="billing">
          <Panel.Heading>
            <Panel.Title>{<h1>{infoPage.indexOf(page) >= 0 ? 'Subscription Info' : 'Simple Pricing for Everyone'}</h1>}</Panel.Title>
          </Panel.Heading>
          <StepBar infoPage={infoPage} page={page} />
          {page === PAGE.PLAN_LIST && (
            <CustomizeContainer {...this.props} />
          )}
          {page === PAGE.CONTACT && (
            <ContactContainer {...this.props} />
          )}
          {page === PAGE.PAYMENT && (
            <PaymentContainer {...this.props} />
          )}
          {page === PAGE.INFO && (
            <SummaryContainer {...this.props} />
          )}
          {page === PAGE.ADD_CARD && (
            <AddCard {...this.props} />
          )}
        </Panel>
      </div>
    )
  }
}

Billing.propTypes = propTypes;

function mapStateToProps(state) {
  return { ...state.billing };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({},
    billingActions,
  );
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { Billing };
export default connect(mapStateToProps, mapDispatchToProps)(Billing);
