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
import Select from 'react-virtualized-select';
import { Panel } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import { toast } from 'react-toastify';

const propTypes = {
  column: PropTypes.object,
  entities: PropTypes.array,
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

export default class ColumnViewContainer extends React.Component {
  constructor(props) {
    super(props);
  }

  async onChange(value) {
    const columnId = this.props.column.id;
    if (value) {
      const entityValue = value.value;

      const result = await SupersetClient.put({
        endpoint: `/mappingentity/api/columns/${columnId}`,
        postPayload: { entity: entityValue },
        stringify: false,
      });

      if (result.json.status === true) {
        await this.props.actions.updateEntityColumn(columnId, entityValue);
      } else {
        this.notifyError('Entity has been used');
      }
    } else {
      const result = await SupersetClient.put({
        endpoint: `/mappingentity/api/columns/${columnId}`,
        postPayload: {},
        stringify: false,
      });

      if (result.json.status === true) {
        await this.props.actions.updateEntityColumn(columnId, null);
      }
    }
  }

  notifyError(text) {
    return toast(text, {
      className: 'notify-error',
    });
  }

  render() {
    const { column, entities, filterOptions } = this.props;

    return (
      <Panel className="mapping-item">
        <Panel.Body>
          <div>
            <span>
              <strong>Column: </strong> {column.column_name}
            </span>
            <Select
              filterOptions={filterOptions}
              options={entities}
              onChange={this.onChange.bind(this)}
              value={column.entity}
              placeholder={`${entities.length} option(s)`}
            />
          </div>
        </Panel.Body>
      </Panel>
    );
  }
}

ColumnViewContainer.propTypes = propTypes;
