import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-virtualized-select';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string,PropTypes.number]),
};

const defaultProps = {
  onChange: () => {},
};


export default class SelectRule extends React.Component {

  constructor(props) {
    super(props);
  }

  change(selectValue){
  	this.props.onChange(selectValue,this.props.param);
  }

  // This wouldn't be necessary but might as well
  render() {
    const value = this.props.data === undefined ? [] : this.props.data;
    return (
      <Select 
        placeholder={this.props.placeholder}
        options={this.props.options}
        onChange={(selectValue) => this.change(selectValue)}
        value={this.props.value}
        param={this.props.param}
      />
    );
  }
}

SelectRule.propTypes = propTypes;
SelectRule.defaultProps = defaultProps;