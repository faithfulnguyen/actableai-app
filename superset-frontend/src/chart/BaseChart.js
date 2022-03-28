import React, { Component } from 'react';
import axios from 'axios';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';
import PendingChart from './PendingChart';
import { updateTaskid } from './chartAction';

class BaseChart extends Component {
  constructor(props) {
    super(props);
    this.state = {
      taskStatus: 'PROCESSING',
      taskId: null,
      chartData: null,
      isPolling: true,
      polling: null,
      reQuery: true,
      message: null,
    };
  }

  UNSAFE_componentWillMount() {
    const { taskId } = this.props.queryResponse.data;
    this.setData(taskId);
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  UNSAFE_componentWillUpdate(nextProps, nextState, nextContext) {
    if (
      nextProps.queryResponse.data.taskId !==
      this.props.queryResponse.data.taskId
    ) {
      const { taskId } = nextProps.queryResponse.data;
      this.setData(taskId);
    }
    const nextIsPolling =
      nextProps.chart === undefined
        ? nextProps.isPolling
        : nextProps.chart.isPolling;
    const isPolling =
      this.props.chart === undefined
        ? this.props.isPolling
        : this.props.chart.isPolling;
    if (nextIsPolling !== isPolling) {
      if (!nextIsPolling) {
        clearInterval(this.state.polling);
      }
    }
  }

  componentWillUnmount() {
    this.deleteTask();
    window.removeEventListener('resize', this.handleResize);
  }

  setData(taskId) {
    this.props.actions.setPollingStatus(this.props.chartId, true);
    this.props.actions.setTaskId(this.props.chartId, taskId);

    const polling = setInterval(
      async function() {
        const result = await SupersetClient.get({
          endpoint: this.taskUrl(taskId),
        });
        const chartData = result.json;
        this.setState(
          {
            taskStatus: chartData.status,
            taskId,
            chartData,
            isPolling: chartData.status !== 'SUCCESS',
          },
          () => {
            if (this.state.taskStatus === 'PROCESSING' || (this.state.taskStatus === 'SUCCESS' && !this.state.chartData.data)) {
            } else {
              clearInterval(this.state.polling);
              if ((this.state.taskStatus === 'SUCCESS' && this.state.chartData.data) || this.state.taskStatus === 'PENDING') {
                this.props.actions.chartUpdateData(chartData, this.props.chartId);
                this.props.actions.setPollingStatus(this.props.chartId, false);
                if (!this.state.reQuery) {
                  updateTaskid(
                    this.props.chartId,
                    this.state.taskId,
                  );
                }
              } else if (
                this.state.taskStatus === 'RETRY'
                || this.state.taskStatus === 'REVOKED'
                // || (this.state.taskStatus === 'PENDING' && this.props.chartId > 0)
              ) {
                this.reQuery();
              } else if (this.state.taskStatus === 'FAILURE') {
                let validation_message = '';

                const validations = this.state.chartData.validations || [];
                for (let i = 0; i < validations.length; i++) {
                  validation_message += `\n ${validations[i].level}: ${validations[i].message}`;
                }
                const message =
                  validations.length > 0
                    ? validation_message
                    : this.state.chartData.messenger;
                this.stopQuery(message);
                return;
              }
            }
          },
        );
      }.bind(this),
      2000,
    );
    this.setState({ polling });
  }

  taskUrl(taskId) {
    throw Error(
      'Please override this method to return task url for getting specified data.',
    );
  }

  deleteTask(e) {
    if ([('SUCCESS', 'FAILURE')].indexOf(this.state.taskStatus) === -1) {
      axios.delete(`/api/task/${this.state.taskId}`);
    }
  }

  stopQuery(message) {
    // delete taskId
    axios.delete(`/api/task/${this.state.taskId}`);
    // stop query
    this.props.actions.setPollingStatus(this.props.chartId, false);
    this.props.actions.chartRenderingFailed(message, this.props.chartId, null);
  }

  reQuery() {
    if (this.state.reQuery) {
      this.setState({ reQuery: false });
      // delete taskId
      axios.delete(`/api/task/${this.state.taskId}`);
      // rerun query
      this.props.actions.setTaskId(this.props.chartId, null);
      this.props.actions.triggerQuery(true, this.props.chartId);
    }
  }

  handleResize() {
    // 'Please override this method to handleResize.
  }

  renderLoading() {
    return <Loading size={50} />;
  }

  renderFail() {
    return <div />;
  }

  renderCharts() {
    throw Error('Please override this method to render chart.');
  }

  render() {
    if (this.props.chart.chartStatus === 'loading' || this.state.taskStatus === 'PROCESSING')
      return this.renderLoading();
    if (this.state.taskStatus === 'PENDING')
      return <PendingChart reQuery={this.reQuery.bind(this)} />;
    if (this.state.taskStatus === 'SUCCESS' && this.state.chartData && this.state.chartData.data)
      return this.renderCharts();
    return this.renderFail();
  }
}

export default BaseChart;
