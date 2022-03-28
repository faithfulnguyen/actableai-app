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
import { now, fDuration } from '../modules/dates';

const propTypes = {
  endTime: PropTypes.number,
  isRunning: PropTypes.bool.isRequired,
  startTime: PropTypes.number,
  status: PropTypes.string,
  style: PropTypes.object,
};

const defaultProps = {
  endTime: null,
  startTime: null,
  status: 'success',
  style: null,
};

export default class Timer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      clockStr: '',
      labelStatus: 'label-warning'
    };
    this.stopwatch = this.stopwatch.bind(this);
  }
  UNSAFE_componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  componentDidUpdate(){
    if (this.props && this.props.isRunning) {
      this.startTimer();
    }
  }
  startTimer() {
    this.setState({ labelStatus: 'label-warning' });
    if (!this.timer) {
      this.timer = setInterval(this.stopwatch, 30);
    }
  }
  stopTimer() {
    this.timer = clearInterval(this.timer);
    let status = this.props.status;
    if(this.props.customPolling && this.props.chart && !this.props.chart.isPolling) {
      status = "success";
    }
    this.setState({ labelStatus: `label-${status}` });
  }
  stopwatch() {
    if (this.props && this.props.startTime) {
      const endDttm = now();
      if (this.props.startTime < endDttm) {
        const clockStr = fDuration(
          (this.props.chart?.queryResponse?.data?.runtime * 1000)
          || (this.props.startTime - endDttm));
        this.setState({ clockStr });
      }
      if (this.props && !this.props.customPolling) {
        if (!this.props.isRunning) {
          this.stopTimer();
        }
      } else if (this.props.chart && !this.props.chart.isPolling) {
          this.stopTimer();
        }
    }
  }
  render() {
    let timerSpan = null;
    if (this.props) {
      timerSpan = (
        <span
          className={`inlineBlock m-r-5 label ${this.state.labelStatus}`}
          style={this.props.style}
        >
          {this.state.clockStr}
        </span>
      );
    }
    return timerSpan;
  }
}

Timer.propTypes = propTypes;
Timer.defaultProps = defaultProps;