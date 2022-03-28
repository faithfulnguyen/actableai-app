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
import { ControlLabel } from 'react-bootstrap';
import Select from "react-virtualized-select";

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const databases = bootstrapData.databases;
const propTypes = {
  databases: PropTypes.array,
};

export default class SelectDataSource extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      value: null,
    }
  }

  onChange(value) {
    if (value) {
      const datasourceId = value.value;
      this.setState({ value: datasourceId });
      this.props.actions.fetchTable(datasourceId);
      this.props.actions.updateDatasource(value.label);
    } else {
      this.setState({ value: null });
      this.props.actions.updateDatasource(null);
      this.props.actions.updateTable(null);
    }
  }

  render() {
    const { value } = this.state;
    return (
      <div>
        <div className="ControlHeader">
          <div className="pull-left">
            <ControlLabel>
              <span>Databases</span>
            </ControlLabel>
          </div>
          <div className="clearfix" />
          <Select
            options={databases}
            onChange={this.onChange.bind(this)}
            value={value}
            placeholder={`${databases.length} option(s)`}
          />
        </div>
      </div>
    );
  }
}

SelectDataSource.propTypes = propTypes;