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
import { Panel, Button, FormControl } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import { exportChart } from '../exploreUtils';
import styled from 'styled-components';

const FormContainer = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: 8px;
  align-items: center;
`;

const propTypes = {
  bootstrapData: PropTypes.object,
  latestQueryFormData: PropTypes.object,
};

export default class AddTableFromSaveQuery extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onSelectDatabase = this.onSelectDatabase.bind(this);
    this.onSelectSchema = this.onSelectSchema.bind(this);
    this.onChangeTable = this.onChangeTable.bind(this);
    this.doSaveTable = exportChart.bind(
      this,
      this.props.latestQueryFormData,
      'table',
      '_self',
    );

    this.state = {
      databaseId: null,
      schemaLoading: false,
      schemas: [],
      schema: null,
      tables: [],
      table: null,
      tableLoading: false,
      addLoading: false,
      showErrors: false,
    };
  }

  async onSelectDatabase(value) {
    this.props.latestQueryFormData.database_name = value.label;
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
      this.props.latestQueryFormData.schema_name = value.label;
      const schema = value.value;
      if (schema !== this.state.schema) {
        this.setState({ schema });
      }
    } else {
      this.setState({ schema: null });
    }
  }

  onChangeTable(value) {
    this.props.latestQueryFormData.save_table_name = value;
    if (value) {
      const table = value;
      if (table !== this.state.table) {
        this.setState({ table });
      }
    } else {
      this.setState({ table: null });
    }
  }

  render() {
    const { dbs } = this.props.bootstrapData;
    const {
      databaseId,
      schemas,
      schema,
      schemaLoading,
      table,
      addLoading,
    } = this.state;
    return (
      <Panel id="add-table">
        <Panel.Heading style={{ paddingTop: '0' }}>
          <Panel.Title style={{ paddingBottom: '15px' }}>
            {<h4>Add table to database</h4>}
          </Panel.Title>
        </Panel.Heading>
        <FormContainer className='form-group'>
          <div>
            <label>
              Database<strong>*</strong>
            </label>
          </div>
          <div>
            <Select
              options={dbs}
              placeholder={`${dbs.length} option(s)`}
              onChange={this.onSelectDatabase}
              value={databaseId}
            />
          </div>
          {this.state.showErrors && !databaseId && (
            <>
              <div></div>
              <div className='has-error'>
                <div className='help-block'>
                  {t('Please select a database')}
                </div>
              </div>
            </>
          )}
          <div>
            <label>Schema</label>
          </div>
          <div>
            <Select
              options={schemas}
              placeholder={`${schemas.length} option(s)`}
              onChange={this.onSelectSchema}
              value={schema}
              isLoading={schemaLoading}
            />
          </div>
          {this.state.showErrors && !schema && (
            <>
              <div></div>
              <div className='has-error'>
                <div className='help-block'>
                  {t('Please select a schema')}
                </div>
              </div>
            </>
          )}
          <div></div>
          <span className="help-block">
            Schema, as used only in some databases like Postgres, Redshift
            and DB2
          </span>
          <div>
            <label>
              Table Name<strong>*</strong>
            </label>
          </div>
          <div>
            <FormControl
              type="text"
              placeholder={t('Your table name')}
              value={table}
              onChange={e => this.onChangeTable(e.target.value)}
            />
          </div>
          {this.state.showErrors && !table && (
            <>
              <div></div>
              <div className='has-error'>
                <div className='help-block'>
                  {t('Please input a name for the new table.')}
                </div>
              </div>
            </>
          )}
          <div></div>
          <span className="help-block">
            Name of the table that you want to save to database
          </span>
          <div></div>
          <Button
            className="btn-blue mr-10"
            onClick={() => {
              if(!table || !databaseId || !schema) {
                this.setState({ showErrors: true });
              }else{
                this.doSaveTable();
              }
            }}
            disabled={this.state.showErrors && (!table || !databaseId || !schema)}
          >
            {addLoading 
              ? <img src="/static/assets/images/loading-white.gif" />
              : 'Add'}
          </Button>
        </FormContainer>
      </Panel>
    );
  }
}

AddTableFromSaveQuery.propTypes = propTypes;
