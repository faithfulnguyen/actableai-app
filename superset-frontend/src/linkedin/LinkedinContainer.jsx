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

export default class LinkedinViewContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    const appContainer = document.getElementById('app');
    const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));

    this.state = {
      email: bootstrapData.email,
      cookies: '',
      sampleRate: '',
      searchUrl: '',
      prefix: '',
      connectStatus: 'NO_PROCESS',
    };
  }

  onChangeCookies(event) {
    this.setState({ cookies: event.target.value });
  }

  onChangeSampleRate(event) {
    this.setState({ sampleRate: event.target.value });
  }

  onChangeSearchUrl(event) {
    this.setState({ searchUrl: event.target.value });
  }

  onChangePrefix(event) {
    this.setState({
      prefix: event.target.value.replace(/[&/\\#,+()$~%.'":*?<>{}`-]/g, ''),
    });
  }

  async onClickConnect() {
    SupersetClient.post({
      endpoint: 'api/table/check-existed',
      postPayload: {
          prefix: this.state.prefix,
        }
    }).then(response => {
          if (!response.json.status) {
            this.goToList()
          }
      }
    )


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
          name: this.state.email,
          position: {
            x: Math.floor(Math.random() * 1000) + 1,
            y: Math.floor(Math.random() * 1000) + 1,
          },
        },
      }),
    });

    const createProcessGroup = await createProcessGroupRes.json();

    let { json: templatesInfo } = await SupersetClient.get({
      endpoint: '/nifi-api/flow/templates',
    });
    const { templates } = templatesInfo;
    let sapTemplate = _.find(templates, function (o) { return o.template.name = 'Scrape Linkedin'; });

    if (!sapTemplate) {
      await SupersetClient.post({
        endpoint: '/templates/upload',
        postPayload: {
          file_name: 'Scrape_Linkedin.xml',
        },
        stringify: false,
      });
      let { json: templatesInfo } = await SupersetClient.get({
        endpoint: '/nifi-api/flow/templates',
      });
      const { templates: newTemplates } = await templatesInfo;
      sapTemplate = _.find(newTemplates, function (o) { return o.template.name = 'Scrape Linkedin'; });
    }

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

    const cookies = JSON.stringify(this.state.cookies).replace(/\\n/g, '').replace(/ /g, '');

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
              'Command Arguments': `/scrapers/scrape_linkedin.js ${this.state.email} ${encodeURI(cookies)} ${this.state.prefix} ${this.state.sample_rate} ${encodeURI(this.state.searchUrl)} ${createProcessGroup.id} 1 1`
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
      endpoint: '/linkedin/add',
      postPayload: {
        email: this.state.email,
        sample_rate: this.state.sampleRate,
        group_id: createProcessGroup.id,
        prefix: this.state.prefix,
        search_url: encodeURI(this.state.searchUrl),
        temp_cookies: encodeURI(this.state.cookies),
      },
      stringify: false,
    });

    if (addResponse.message) {
      this.goToList();
    }

  }

  goToList() {
    window.location.href = '/linkedin/list';
  }

  render() {
    const { email, cookies, connectStatus, sampleRate, searchUrl, prefix } = this.state;

    return (
      <Panel id="sap">
        <Panel.Heading>
          <Panel.Title>{<h4>Add linkedin connection information</h4>}</Panel.Title>
        </Panel.Heading>
        <div className="row">
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Table Prefix<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <input
                className="form-control"
                placeholder="Table prefix"
                value={prefix}
                onChange={this.onChangePrefix.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Sample rate (%)<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <input
                className="form-control"
                placeholder="Sample rate (0% - 100%)"
                type="number"
                value={sampleRate}
                onChange={this.onChangeSampleRate.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Search URL<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <textarea
                className="form-control"
                placeholder="Search URL"
                value={searchUrl}
                onChange={this.onChangeSearchUrl.bind(this)}
              />
            </div>
          </div>
          <div className="col-sm-6 form-group">
            <div className="col-sm-2">
              <label>Cookies<strong>*</strong></label>
            </div>
            <div className="col-sm-10">
              <textarea
                  type="text"
                  className="form-control"
                  placeholder="Cookies"
                  onChange={this.onChangeCookies.bind(this)}
                  value={cookies}
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
                  disabled={!(cookies && prefix && sampleRate && searchUrl && parseInt(sampleRate)>0 && parseInt(sampleRate)<=100)}
                >Add</Button>
              ) : (
                  <Button className="btn-blue mr-10"><img src='/static/assets/images/loading-white.gif' /></Button>
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

LinkedinViewContainer.propTypes = propTypes;
