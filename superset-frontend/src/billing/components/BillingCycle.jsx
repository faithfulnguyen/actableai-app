import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { FormGroup, ControlLabel, Button } from 'react-bootstrap';
import countryList from 'react-select-country-list';
import { INTERVAL } from '../constants/index';

const propTypes = {};

export default class BillingCycle extends React.PureComponent {
  constructor(props) {
    super(props)
  }

  render() {
    const { plan, interval } = this.props;
    const options = [
      { value: INTERVAL.MONTH, label: `1 Month Price - $${plan.price}` },
      { value: INTERVAL.YEAR, label: `1 Year Price - $${plan.annual_price}` },
    ]

    return (
        <Select
          options={options}
          value={interval}
          onChange={this.props.onChangeCycle}
        />
    )
  }
}

BillingCycle.propTypes = propTypes;
