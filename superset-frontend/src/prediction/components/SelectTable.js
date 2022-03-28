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

const propTypes = {
  tables: PropTypes.array,
};

export default class SelectTable extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      value: null,
    }
  }

  onChange(value) {
    if (value) {
      const tableId = value.value;
      this.setState({ value: tableId });
      this.props.actions.fetchPredictingVariable(tableId);
      this.props.actions.updateTable(value.label);
    } else {
      this.setState({ value: null });
      this.props.actions.updateTable(null);
      this.props.actions.updatePredictingVariable(null);
    }
  }

  render() {
    const { trainValue, tables } = this.props;
    const { value } = this.state;
    if (!trainValue.nameDatabase) { this.setState({ value: null }); }
    const length = tables === undefined ? 0:  tables.length;
    return (
      <div>
        <div className="ControlHeader">
          <div className="pull-left">
            <ControlLabel>
              <span>Table</span>
            </ControlLabel>
          </div>
          <div className="clearfix" />
          <Select
            options={tables}
            onChange={this.onChange.bind(this)}
            value={value}
            placeholder={`${length} option(s)`}
          />
        </div>
      </div>
    );
  }
}

SelectTable.propTypes = propTypes;