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
import { Button, Panel, Alert } from 'react-bootstrap';

import SelectDataSource from './SelectDataSource';
import SelectTable from './SelectTable';
import SelectPredictingVariable from './SelectPredictingVariable';

const propTypes = {
  trainValue: PropTypes.object,
  testValue: PropTypes.object,
  userInfo: PropTypes.object,
  testPredictions: PropTypes.array,
};

export default class ControlPanelsContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      predictStatus: 'NO_PROCESS',
      testResult: '',
    };
  }

  async testPrediction() {
    // loading
    await this.props.actions.updateLoading(true);
    const { trainValue, inputData, userInfo } = this.props;
    this.setState({ predictStatus: 'PROCESS' });

    const value = {
      ...trainValue,
      inputData,
      userId: userInfo.id,
    };

    const { status, data } = await this.props.actions.testPrediction(value);
    await this.props.actions.updateResult(data);
    await this.setState({ predictStatus: status, testResult: data });
    // end loading
    await this.props.actions.updateLoading(false);
  }

  render() {
    const { predictStatus, testResult } = this.state;
    const { trainValue, testPredictions, inputData } = this.props;
    let checkInput = false;
    if (inputData !== undefined && Object.keys(inputData).length > 0) {
      checkInput = true;
    }
    return (
      <div id="predict-control">
        <Panel>
          <Panel.Heading>
            <Panel.Title>{<h3>Data</h3>}</Panel.Title>
          </Panel.Heading>
          <div className="col-sm-12 row no-padding">
            <div className="col-sm-6">
              <SelectDataSource {...this.props} />
            </div>
          </div>
          <div className="col-sm-12 row no-padding">
            <div className="col-sm-6">
              <SelectTable {...this.props} />
            </div>
            <div className="col-sm-6">
              <SelectPredictingVariable {...this.props} />
            </div>
          </div>
        </Panel>
        <Panel>
          <Panel.Heading>
            <Panel.Title>{<h3>Prediction</h3>}</Panel.Title>
          </Panel.Heading>
          <div className="row">
            <div className="col-sm-6">
              {predictStatus !== 'PROCESS' ? (
                <Button
                  className="btn-green"
                  onClick={this.testPrediction.bind(this)}
                  disabled={!(trainValue.predictValue && checkInput)}
                >
                  Predict
                </Button>
              ) : (
                <Button bsStyle="warning">Waiting...</Button>
              )}
            </div>
          </div>
        </Panel>
      </div>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;
