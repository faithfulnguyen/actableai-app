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
import { ControlLabel } from 'react-bootstrap';
import Select from "react-virtualized-select";

const propTypes = {
  predictions: PropTypes.array,
};

export default class SelectPredictingVariable extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      value: null,
    }
  }

  async onChange(value) {
    if (value) {
      const predictingVariable = value.value;
      // check value changed
      if (predictingVariable === this.state.value) { return; }
      //
      this.setState({ value: predictingVariable });
      await this.props.actions.updatePredictingVariable(predictingVariable);
      // train model when change predicting variable
      this.trainModel();
    } else {
      this.props.actions.updatePredictingVariable(null);
      this.setState({ value: null });
    }
  }

  async trainModel() {
    // loading
    this.props.actions.updateLoading(true);
    // get params
    const { trainValue, userInfo, loading } = this.props;
    trainValue.userId = userInfo.id;
    const data = await this.props.actions.trainModel(trainValue);
    // update data train
    await this.props.actions.updateTrain(data);
    // end loading
    await this.props.actions.updateLoading(false);
  }

  render() {
    const { trainValue, predictingVariable } = this.props;
    if (!trainValue.predictValue) { this.setState({ value: null }); }
    const { value } = this.state;
    const length = predictingVariable === undefined ? 0 : predictingVariable.length;
    return (
      <div>
        <div className="ControlHeader">
          <div className="pull-left">
            <ControlLabel>
              <span>Predicting Variable</span>
            </ControlLabel>
          </div>
          <div className="clearfix" />
          <Select
            options={predictingVariable}
            onChange={this.onChange.bind(this)}
            value={value}
            placeholder={`${length} option(s)`}
          />
        </div>
      </div>
    );
  }
}

SelectPredictingVariable.propTypes = propTypes;
