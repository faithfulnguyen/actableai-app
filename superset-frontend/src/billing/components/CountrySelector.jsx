import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as billingActions from '../actions/index';
import Select from 'react-select';
import { FormGroup, ControlLabel, Button } from 'react-bootstrap';
import countryList from 'react-select-country-list';

const propTypes = {};

class CountrySelector extends React.PureComponent {
  constructor(props) {
    super(props)
    this.options = countryList().getData();
    this.handleChange = this.handleChange.bind(this);

  }

  async handleChange(e) {
    if (e) {
      await this.props.actions.updateInfo(this.props.source, e.value);
    }
  }

  render() {
    const { source } = this.props;
    return (
      <FormGroup>
        <ControlLabel>Country</ControlLabel>
        <Select
          options={this.options}
          value={this.props[source]}
          onChange={this.handleChange}
        />
      </FormGroup>
    )
  }
}

CountrySelector.propTypes = propTypes;

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

export { CountrySelector };
export default connect(mapStateToProps, mapDispatchToProps)(CountrySelector);
