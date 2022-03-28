import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as billingActions from '../actions/index';
import PhoneInput from 'react-phone-input-2';
import { FormGroup, ControlLabel, Button } from 'react-bootstrap';
import 'react-phone-input-2/lib/style.css';

const propTypes = {};

class PhoneSelector extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  async handleChange(value) {
    await this.props.actions.updateInfo('phone', `+${value}`);
  }

  render() {
    const { phone } = this.props;

    return (
      <FormGroup>
        <ControlLabel>Phone *</ControlLabel>
        <PhoneInput
          country='us'
          value={phone}
          onChange={this.handleChange}
          inputClass={ phone <= 2 ? 'input-error' : '' }
        />
      </FormGroup>
    )
  }
}

PhoneSelector.propTypes = propTypes;

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

export { PhoneSelector };
export default connect(mapStateToProps, mapDispatchToProps)(PhoneSelector);
