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
import { Panel, Button, Alert } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';

const propTypes = {};

export default class SAPViewContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    // get url params
    const search = window.location.search;
    const params = new URLSearchParams(search);
    // get params
    const endpoint = params.get('endpoint');
    const apikey = params.get('apikey');

    this.state = {
      name: '',
      endpointValue: endpoint == null ? '' : endpoint,
      apiKeyValue: apikey == null ? '' : apikey,
      connectStatus: 'NO_PROCESS',
    };
  }

  onChangeName(event) {
    this.setState({ name: event.target.value });
  }

  onChangeEndPoint(event) {
    this.setState({ endpointValue: event.target.value });
  }

  onChangeApiKey(event) {
    this.setState({ apiKeyValue: event.target.value });
  }

  async onClickConnect() {
    this.setState({ connectStatus: 'PROCESS' });
    const { json: processGroup } = await SupersetClient.get({
      endpoint: '/nifi-api/process-groups/root',
    });

    const createProcessGroupRes = await fetch(`/nifi-api/process-groups/${processGroup.id}/process-groups`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        revision: {
          clientId: '', version: 0,
        },
        disconnectedNodeAcknowledged: false,
        component: {
          name: this.state.name,
          position: {
            x: 1,
            y: 1,
          },
        },
      }),
    });

    const createProcessGroup = await createProcessGroupRes.json();

    let { json: templatesInfo } = await SupersetClient.get({
      endpoint: '/nifi-api/flow/templates',
    });
    const { templates } = templatesInfo;
    let sapTemplate = _.find(templates, function (o) { return o.template.name = 'crawl SAP'; });

    if (!sapTemplate) {
      const { json: uploadTemplate } = await SupersetClient.post({
        endpoint: '/templates/upload',
        postPayload: {
          file_name: 'crawl_SAP.xml',
        },
        stringify: false,
      });
    }

    templatesInfo = await SupersetClient.get({
      endpoint: '/nifi-api/flow/templates',
    });
    const newTemplates = await templatesInfo.json.templates;
    sapTemplate = _.find(newTemplates, function (o) { return o.template.name = 'crawl SAP'; });

    const resInstance = await fetch(`/nifi-api/process-groups/${createProcessGroup.id}/template-instance`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: sapTemplate.id,
        disconnectedNodeAcknowledged: false,
        originX: Math.floor(Math.random() * 1000) + 1,
        originY: Math.floor(Math.random() * 1000) + 1,
      }),
    });

    const templateInstance = await resInstance.json();
    const { processors } = templateInstance.flow;
    const executeProcess = _.find(processors, {
      inputRequirement: 'INPUT_FORBIDDEN',
    });


    const client = await fetch('/nifi-api/flow/client-id');
    const clientId = await client.text();

    await fetch(`/nifi-api/processors/${executeProcess.id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        component: {
          config: {
            properties: {
              'Command Arguments': `-d ${this.state.endpointValue} -k ${this.state.apiKeyValue} -l 0.4`,
              'Command': '/usr/local/bin/crawlsap',
            },
          },
          id: executeProcess.id,
        },
        revision: { clientId, version: 0 },
      }),
    });

    const { json: ctlServices } = await SupersetClient.get({
      endpoint: `/nifi-api/flow/process-groups/${createProcessGroup.id}/controller-services`,
    });

    const putSQLProcess = _.find(processors, o => o.component.name === 'PutSQL');
    const DBCPService = _.find(ctlServices.controllerServices, o => o.component.referencingComponents[0].id === putSQLProcess.id);
    await fetch(`/nifi-api/controller-services/${DBCPService.id}/run-status`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        disconnectedNodeAcknowledged: false,
        state: 'ENABLED',
        revision: { clientId, version: 0 },
      }),
    });

    const processRunning = await fetch(`/nifi-api/flow/process-groups/${createProcessGroup.id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        disconnectedNodeAcknowledged: false,
        id: createProcessGroup.id,
        state: 'RUNNING',
      }),
    });

    const { json: addResponse } = await SupersetClient.post({
      endpoint: '/sap/add',
      postPayload: {
        name: this.state.name,
        end_point: this.state.endpointValue,
        api_key: this.state.apiKeyValue,
        group_id: createProcessGroup.id,
      },
      stringify: false,
    });

    if (addResponse.message === 'Success') {
      this.goToList();
    }

  }

  goToList() {
    window.location.href = '/sap/list';
  }

  render() {
    const { endpointValue, apiKeyValue, connectStatus, name } = this.state;

    return (
      <Panel id="sap">
        <Panel.Heading>
          <Panel.Title>{<h4>Add SAP connect info</h4>}</Panel.Title>
        </Panel.Heading>
        <div className="row">
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Name<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <input
                className="form-control"
                placeholder="Name"
                value={name}
                onChange={this.onChangeName.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Endpoint<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <input
                className="form-control"
                placeholder="Endpoint"
                value={endpointValue}
                onChange={this.onChangeEndPoint.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>API KEY<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <input
                className="form-control"
                placeholder="API KEY"
                value={apiKeyValue}
                onChange={this.onChangeApiKey.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-12 form-group">
            <div className="col-sm-1" />
            <div className="col-sm-11">
              {connectStatus != 'PROCESS' ? (
                <Button
                  className="btn-blue mr-10"
                  onClick={this.onClickConnect.bind(this)}
                  disabled={!(endpointValue && apiKeyValue)}
                >Add</Button>
              ) : (
                  <Button bsStyle="warning">Waiting...</Button>
                )}
              {
                connectStatus !== 'PROCESS' && (
                  <Button
                    className="btn-cancel mr-10"
                    onClick={this.goToList.bind(this)}
                  >Cancel</Button>
                )
              }
            </div>
          </div>
        </div>
      </Panel>
    );
  }
}

SAPViewContainer.propTypes = propTypes;
