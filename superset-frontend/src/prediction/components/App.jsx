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
import ControlPanelsContainer from './ControlPanelsContainer';
import ChartContainer from './ChartContainer';
import * as predictActions from '../actions/predictActions';

const propTypes = {};

class PredictViewContainer extends React.Component {
  render() {
    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-sm-4">
            <ControlPanelsContainer {...this.props} />
          </div>
          <div className="col-sm-8">
            <ChartContainer {...this.props} />
          </div>
        </div>
      </div>
    );
  }
}

PredictViewContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return { ...state.predict };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({},
    predictActions,
  );
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { PredictViewContainer };
export default connect(mapStateToProps, mapDispatchToProps)(PredictViewContainer);