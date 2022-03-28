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
import Select from 'react-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from '../utils/getClientErrorObject';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  mutator: PropTypes.func.isRequired,
  onAsyncError: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
  ]),
  valueRenderer: PropTypes.func,
  placeholder: PropTypes.string,
  autoSelect: PropTypes.bool,
  dataSourceId: PropTypes.number
};

const defaultProps = {
  placeholder: t('Select ...'),
  onAsyncError: () => { },
};

class OwnersSelect extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      options: [],
      keyword: "",
      typingTimeout: 0
    };
    this.onChange = this.onChange.bind(this);
    this.onInputChange = this.onInputChange.bind(this);

  }

  componentDidMount() {
    this.getOwnerData(this.props.dataSourceId);
  }

  onChange(option) {
    this.setState({ isLoading: false });
    this.props.onChange(option);
  }

  onInputChange(value) {
    if (value) {
      if (this.state.typingTimeout) {
        clearTimeout(this.state.typingTimeout);
      }

      this.setState({
        keyword: value,
        isLoading: true,
        typingTimeout: setTimeout(function () {
          this.getOptionsAsync(this.state.keyword);
        }.bind(this), 3000)
      });
    }
    else {
      this.setState({ isLoading: false, keyword: "" })
    }
  }

  getOptionsAsync(newInput) {
    if (newInput) {
      const { mutator, dataEndpoint, value } = this.props;

      let endpoint = dataEndpoint;
      endpoint = dataEndpoint + `?email=${encodeURIComponent(newInput)}`;

      return SupersetClient.get({ endpoint: endpoint })
        .then(({ json }) => {
          const selectedOptions = this.props.value;
          let options = this.state.options;
          if (json) {
            options = options.filter(item => selectedOptions.includes(item.value));
            options.push({
              value: json.id,
              label: json.email
            });
            this.setState({ options, isLoading: false });
          }
        })
        .catch(response =>
          getClientErrorObject(response).then(error => {
            this.props.onAsyncError(error.error || error.statusText || error);
            this.setState({ isLoading: false });
          }),
        );
    }

  }

  getOwnerData(id) {
    const endPoint = `/api/v1/dataset/${id}?q={"columns":["owners.id", "owners.email"]}`
    return SupersetClient.get({ endpoint: endPoint })
      .then(({ json }) => {
        if (json.result) {
          const options = json.result.owners.map(item => {
            return { value: item.id, label: item.email }
          });
          this.setState({ options, isLoading: false });
        }
      })
      .catch(response =>
        getClientErrorObject(response).then(error => {
          this.setState({ isLoading: false });
        }),
      );
  }


  render() {
    return (
      <Select
        placeholder={this.props.placeholder}
        options={this.state.options}
        value={this.props.value}
        isLoading={this.state.isLoading}
        onChange={this.onChange}
        valueRenderer={this.props.valueRenderer}
        {...this.props}
        onInputChange={this.onInputChange}
      />
    );
  }
}

OwnersSelect.propTypes = propTypes;
OwnersSelect.defaultProps = defaultProps;

export default OwnersSelect;
