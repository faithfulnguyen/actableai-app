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
import { Panel } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import Select from 'react-virtualized-select';
import { toast } from 'react-toastify';
import { Creatable } from 'react-select';

const propTypes = {
  table: PropTypes.object,
  entities: PropTypes.array,
  showTable: PropTypes.number,
  filterOptions: PropTypes.array,
};

toast.configure({
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
});

export default class TableViewContainer extends React.Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {
    this.setState({ entityValue: this.props.table.entity });
  }

  async onChange(value) {
    const tableId = this.props.table.id;

    if (value) {
      const entityValue = value.value;
      this.setState({ entityValue });

      const result = await SupersetClient.put({
        endpoint: `/mappingentity/api/tables/${tableId}`,
        postPayload: { entity: entityValue },
        stringify: false,
      });

      if (result.json.status === false) {
        this.notifyError('Entity has been used');
        this.setState({ entityValue: null });
      }
    } else {
      this.setState({ entityValue: null });
      await SupersetClient.put({
        endpoint: `/mappingentity/api/tables/${tableId}`,
        postPayload: {},
        stringify: false,
      });
      if (this.props.showTable == tableId) {
        await this.props.actions.clickShowTable(tableId);
      }
    }
  }

  async onClickShowColumn() {
    const { id } = this.props.table;
    await this.props.actions.clickShowTable(id);
  }

  render() {
    const { table, entities, showTable, filterOptions } = this.props;
    const { entityValue } = this.state;
    return (
      <Panel className="mapping-item">
        <Panel.Body>
          <div>
            <span>
              <strong>Table: </strong> {table.table_name}{' '}
              <i>({table.database})</i>
            </span>
            <div className="box-table-right">
              <Select
                filterOptions={filterOptions}
                options={entities}
                onChange={this.onChange.bind(this)}
                value={entityValue}
                placeholder={`${entities.length} option(s)`}
              />
              {showTable === table.id ? (
                <i className="fa fa-chevron-right" />
              ) : (
                <i
                  className="fa fa-list-ul"
                  onClick={this.onClickShowColumn.bind(this)}
                />
              )}
            </div>
          </div>
        </Panel.Body>
      </Panel>
    );
  }
  notifyError(text) {
    return toast(text, {
      className: 'notify-error',
    });
  }
}

TableViewContainer.propTypes = propTypes;
