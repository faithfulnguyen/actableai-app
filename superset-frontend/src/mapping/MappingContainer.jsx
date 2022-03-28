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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Panel, Button } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import { toast } from 'react-toastify';
import * as mappingActions from './actions/index';
import TableContainer from './components/TableViewContainer';
import ColumnContainer from './components/ColumnViewContainer';
import 'react-toastify/dist/ReactToastify.css';
import createFilterOptions from 'react-select-fast-filter-options';
import { t } from '@superset-ui/translation';

const propTypes = {
  bootstrapData: PropTypes.object,
  list_tables: PropTypes.array,
  columns: PropTypes.array,
};

toast.configure({
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
});

class MappingContainer extends React.Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {
    const { entities, status } = this.props.bootstrapData;
    const entitySelect = entities.map(entity => {
      return {
        label: entity,
        value: entity,
      };
    });
    this.setState({ entitySelect, statusTrain: status });
    if (status === 'PROCESSING') {
      this.checkProcessTrain();
    }
  }

  checkProcessTrain() {
    const polling = setInterval(
      async function() {
        const result = await SupersetClient.get({
          endpoint: '/mappingentity/api/get-status-train',
        });

        const status = result.json;
        if (status != 'PROCESSING') {
          this.setState({ statusTrain: status });
          if (status === 'DONE') {
            this.notifySuccess('Save successfully!');
          }
          clearInterval(polling);
        }
      }.bind(this),
      5000,
    );
  }

  async train() {
    this.setState({ statusTrain: 'PROCESSING' });
    const data = await SupersetClient.post({
      endpoint: '/mappingentity/api/train',
    });

    this.setState({ statusTrain: data.json });

    if (data.json === 'PROCESSING') {
      this.checkProcessTrain();
    }
  }

  async redirectToNLU() {
    const nluUrl = window.origin + '/nlu/';
    window.open(nluUrl, '_blank');
  }

  async redirectToOntologyPage() {
    const nluUrl = window.origin + '/ontology/list';
    window.location.href = nluUrl;
  }

  renderButtonTrain(statusTrain) {
    if (statusTrain === 'PROCESSING') {
      return <Button bsStyle="warning">Waiting...</Button>;
    }
    if (statusTrain === 'ERROR') {
      return (
        <Button bsStyle="danger" onClick={this.train.bind(this)}>
          Error! Try again.
        </Button>
      );
    }
    return (
      <Button className="btn-blue" onClick={this.train.bind(this)}>
        Save
      </Button>
    );
  }
  renderNLULinkButton() {
    return (
      <Button
        type="button"
        className="btn-green ml-10"
        onClick={this.redirectToNLU.bind(this)}
      >
        Custom Template
      </Button>
    );
  }

  renderOntologyPageLinkButton() {
    return (
      <Button
        type="button"
        className="btn-blue ml-10"
        onClick={this.redirectToOntologyPage.bind(this)}
      >
        New Ontology
      </Button>
    );
  }

  renderHeader(statusTrain) {
    return (
      <>
        <div>
          {this.renderButtonTrain(statusTrain)}
          {this.renderOntologyPageLinkButton()}
          {this.renderNLULinkButton()}
        </div>
      </>
    );
  }

  notifySuccess(text) {
    return toast(text, {
      className: 'notify-success',
    });
  }

  render() {
    const { columns, actions, showTable } = this.props;
    const { list_tables: listTables, entities } = this.props.bootstrapData;
    const { entitySelect, statusTrain } = this.state;
    const filterOptions = createFilterOptions({ options: entitySelect });
    return (
      <div id="mapping">
        <Panel id="mapping">
          <Panel.Heading>
            <Panel.Title>
              {<h4>Mapping Entity</h4>}
              {this.renderHeader(statusTrain)}
            </Panel.Title>
          </Panel.Heading>
          <div className="row">
            <div className="col-md-6 box-scroll">
              {listTables.map((table, i) => {
                return (
                  <TableContainer
                    key={i}
                    table={table}
                    entities={entitySelect}
                    actions={actions}
                    showTable={showTable}
                    filterOptions={filterOptions}
                  />
                );
              })}
            </div>
            <div className="col-md-6 box-scroll">
              {columns.map((column, i) => {
                return (
                  <ColumnContainer
                    key={i}
                    column={column}
                    entities={entitySelect}
                    actions={actions}
                    filterOptions={filterOptions}
                  />
                );
              })}
            </div>
          </div>
        </Panel>
      </div>
    );
  }
}

MappingContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return { ...state.mapping };
}

function mapDispatchToProps(dispatch) {
  const actions = Object.assign({}, mappingActions);
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { MappingContainer };
export default connect(mapStateToProps, mapDispatchToProps)(MappingContainer);
