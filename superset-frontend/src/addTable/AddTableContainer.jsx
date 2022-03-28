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
import _ from 'lodash';
import Select from 'react-virtualized-select';
import { Panel, Button, Alert } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';

const propTypes = {
  bootstrapData: PropTypes.object,
  dbs: PropTypes.array
};

export default class AddTableContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onSelectDatabase = this.onSelectDatabase.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onSelectSchema = this.onSelectSchema.bind(this);
    this.onSelectTable = this.onSelectTable.bind(this);
    this.onChangeIsPublic = this.onChangeIsPublic.bind(this);

    this.onBack = this.onBack.bind(this);

    this.state = {
      databaseId: null,
      schemaLoading: false,
      schemas: [],
      schema: null,
      tables: [],
      table: null,
      is_public:false,
      tableLoading: false,
      addLoading: false,
    };
  }

  async onSelectDatabase(value) {
    if (value) {
      const databaseId = value.value;
      if (databaseId !== this.state.databaseId) {
        this.setState({
          databaseId,
          schemaLoading: true,
          schemas: [],
          schema: null,
          tables: [],
          table: null,
        });
        const { json } = await SupersetClient.get({
          endpoint: `/superset/schemas/${databaseId}/false/`,
        });

        const schemas = [];
        json.schemas.forEach(schema => {
          schemas.push({ value: schema, label: schema });
        });
        if (this.state.databaseId === databaseId) {
          this.setState({ schemas, schemaLoading: false });
        }
      }
    } else {
      this.setState({
        databaseId: null,
        schemas: [],
        schema: null,
        tables: [],
        table: null,
        schemaLoading: false,
        tableLoading: false,
      });
    }
  }

  async onSelectSchema(value) {
    if (value) {
      const schema = value.value;
      if (schema !== this.state.schema) {
        const { databaseId } = this.state;
        this.setState({
          schema,
          tableLoading: true,
          tables: [],
          table: null,
        });
        const { json } = await SupersetClient.get({
          endpoint: `/superset/tables/${databaseId}/${schema}/undefined/false/`,
        });
        const tables = [];
        json.options.forEach(option => {
          if (option.type === 'table') {
            tables.push({
              value: option.value,
              label: option.value,
            });
          }
        });
        if (
          this.state.schema === schema &&
          this.state.databaseId === databaseId
        ) {
          this.setState({ tables, tableLoading: false });
        }
      }
    } else {
      this.setState({
        schema: null,
        tables: [],
        table: null,
        tableLoading: false,
      });
    }
  }

  onSelectTable(value) {
    if (value) {
      const table = value.value;
      if (table !== this.state.table) {
        this.setState({ table });
      }
    } else {
      this.setState({ table: null });
    }
  }

  onSelectTable(value) {
    if (value) {
      const table = value.value;
      if (table !== this.state.table) {
        this.setState({ table });
      }
    } else {
      this.setState({ table: null });
    }
  }

  onChangeIsPublic(event) {
    if (event) {
      const is_public = event.currentTarget.checked;
      if (is_public !== this.state.is_public) {
        this.setState({ is_public });
      }
    } else {
      this.setState({ is_public: null });
    }
  }

  async onSubmit() {
    this.setState({ addLoading: true });
    const { databaseId, schema, table, is_public } = this.state;
    const formData = new FormData();
    formData.append('database', databaseId);
    formData.append('schema', schema);
    formData.append('table_name', table);
    formData.append('is_public', is_public);

    await SupersetClient.post({
      endpoint: '/tablemodelview/add',
      body: formData,
      stringify: false,
    });

    window.location.href = '/';
  }

  onBack() {
    window.location.href = '/';
  }

  render() {
    const { dbs } = this.props.bootstrapData;
    const {
      databaseId,
      schemas,
      schema,
      schemaLoading,
      tables,
      table,
      tableLoading,
      addLoading,
    } = this.state;
    return (
      <Panel id="add-table">
        <Panel.Heading>
          <Panel.Title>{<h4>Connect to Table</h4>}</Panel.Title>
        </Panel.Heading>
        <div className="row">
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>
                Database<strong>*</strong>
              </label>
            </div>
            <div className="col-sm-10">
              <Select
                options={dbs}
                placeholder={`${dbs.length} option(s)`}
                onChange={this.onSelectDatabase}
                value={databaseId}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Schema</label>
            </div>
            <div className="col-sm-10">
              <Select
                options={schemas}
                placeholder={`${schemas.length} option(s)`}
                onChange={this.onSelectSchema}
                value={schema}
                isLoading={schemaLoading}
              />
              <span className="help-block">
                Schema, as used only in some databases like
                Postgres, Redshift and DB2
              </span>
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>
                Table Name<strong>*</strong>
              </label>
            </div>
            <div className="col-sm-10">
              <Select
                options={tables}
                placeholder={`${tables.length} option(s)`}
                onChange={this.onSelectTable}
                value={table}
                isLoading={tableLoading}
              />
              <span className="help-block">
                Name of the table that exists in the source
                database
              </span>
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Is public data</label>
            </div>
            <div className="col-sm-10">
              <input
                type="checkbox"
                name="is_public"
                value={true}
                onChange={this.onChangeIsPublic}
              />
              <span className="help-block">
                Public data sets are seen by other users but analytics using them are free of charge
              </span>
            </div>
          </div>
          <div className="col-sm-12 form-group">
            <div className="col-sm-1" />
            <div className="col-sm-11">
              <Button
                className="btn-blue mr-10"
                onClick={this.onSubmit}
                disabled={!table || addLoading}
              >
                {addLoading ? (
                  <img src="/static/assets/images/loading-white.gif" />
                ) : (
                  'Add'
                )}
              </Button>
              <Button
                className="btn-cancel mr-10"
                onClick={this.onBack}
                disabled={addLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    );
  }
}

AddTableContainer.propTypes = propTypes;
