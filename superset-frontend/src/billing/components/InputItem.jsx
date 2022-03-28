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
import * as billingActions from '../actions/index';
import { FormGroup, ControlLabel, FormControl } from 'react-bootstrap';
import { changeInfo } from '../actions/index';
import { INPUT_ERROR } from '../constants/index.js';

const propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  source: PropTypes.string
};

class InputItem extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  getValidationState() {
    const { source } = this.props;
    if (!this.props[source] && this.props.required) {
      return INPUT_ERROR.ERROR;
    }
    return null;
  }

  async handleChange(e) {
    const { value } = e.target;
    await this.props.actions.updateInfo(this.props.source, value);
  }

  render() {
    const { label, type, source } = this.props;

    return (
      <FormGroup validationState={this.getValidationState()}>
        {label && (<ControlLabel>{label}</ControlLabel>)}
        <FormControl
          type={type || 'text'}
          value={this.props[source]}
          onChange={this.handleChange}
        />
      </FormGroup>
    )
  }
}

InputItem.propTypes = propTypes;

function mapStateToProps(state) {
  return { ...state.billing.info };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({},
    billingActions,
  );
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { InputItem };
export default connect(mapStateToProps, mapDispatchToProps)(InputItem);
