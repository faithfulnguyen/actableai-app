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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import { Label } from 'react-bootstrap';

import { chartPropShape } from '../../dashboard/util/propShapes';
import RowCountLabel from './RowCountLabel';
import EditableTitle from '../../components/EditableTitle';
import AlteredSliceTag from '../../components/AlteredSliceTag';
import FaveStar from '../../components/FaveStar';
import TooltipWrapper from '../../components/TooltipWrapper';
import Timer from '../../components/Timer';
import CachedLabel from '../../components/CachedLabel';
import PropertiesModal from './PropertiesModal';
import { sliceUpdated } from '../actions/exploreActions';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import AuthWrapper from '../../components/AuthWrapper';

const CHART_STATUS_MAP = {
  failed: 'danger',
  loading: 'warning',
  success: 'success',
};

const propTypes = {
  actions: PropTypes.object.isRequired,
  can_download: PropTypes.bool.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  form_data: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
};

export class ExploreChartHeader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isPropertiesModalOpen: false,
    };
    this.openProperiesModal = this.openProperiesModal.bind(this);
    this.closePropertiesModal = this.closePropertiesModal.bind(this);
  }

  postChartFormData() {
    this.props.actions.postChartFormData(
      this.props.form_data,
      true,
      this.props.timeout,
      this.props.chart.id,
    );
  }

  updateChartTitleOrSaveSlice(newTitle) {
    const isNewSlice = !this.props.slice;
    const currentFormData = isNewSlice
      ? this.props.form_data
      : this.props.slice.form_data;

    const params = {
      slice_name: newTitle,
      action: isNewSlice ? 'saveas' : 'overwrite',
    };
    // this.props.slice hold the original slice params stored in slices table
    // when chart is saved or overwritten, the explore view will reload page
    // to make sure sync with updated query params
    this.props.actions.saveSlice(currentFormData, params).then(json => {
      const { data } = json;
      if (isNewSlice) {
        this.props.actions.updateChartId(data.slice.slice_id, 0);
        this.props.actions.createNewSlice(
          data.can_add,
          data.can_download,
          data.can_overwrite,
          data.slice,
          data.form_data,
        );
        this.props.addHistory({
          isReplace: true,
          title: `[chart] ${data.slice.slice_name}`,
        });
      } else {
        this.props.actions.updateChartTitle(newTitle);
      }
    });
  }

  openProperiesModal() {
    this.setState({
      isPropertiesModalOpen: true,
    });
  }

  closePropertiesModal() {
    this.setState({
      isPropertiesModalOpen: false,
    });
  }

  renderChartTitle() {
    let title;
    if (this.props.slice) {
      title = this.props.slice.slice_name;
    } else {
      title = t('%s - untitled', this.props.table_name);
    }
    return title;
  }

  render() {
    const formData = this.props.form_data;
    const {
      chartStatus,
      chartUpdateEndTime,
      chartUpdateStartTime,
      queryResponse } = this.props.chart;
    const chartFinished = ['failed', 'rendered', 'success'].includes(this.props.chart.chartStatus);
    // custom polling
    const pollingVizType = [
      'anova',
      'plotly_correlation',
      'plotly_prediction',
      'classification_prediction',
      'regression_prediction',
      'plotly_tsne',
      'clean_data',
      'sentiment_analysis',
      'causal_inference',
      'bayesian_regression'
    ];
    const customPolling = pollingVizType.includes(this.props.form_data.viz_type);

    return (
      <div id="slice-header" className="clearfix panel-title-large">
        <EditableTitle
          title={this.renderChartTitle()}
          canEdit={!this.props.slice || this.props.can_overwrite}
          onSaveTitle={this.updateChartTitleOrSaveSlice.bind(this)}
        />

        {this.props.slice && (
          <AuthWrapper>
            <span className="icon-group">
              <FaveStar
                itemId={this.props.slice.slice_id}
                fetchFaveStar={this.props.actions.fetchFaveStar}
                saveFaveStar={this.props.actions.saveFaveStar}
                isStarred={this.props.isStarred}
              />
              <PropertiesModal
                show={this.state.isPropertiesModalOpen}
                onHide={this.closePropertiesModal}
                onSave={this.props.sliceUpdated}
                slice={this.props.slice}
              />
              <TooltipWrapper
                label="edit-desc"
                tooltip={t('Edit chart properties')}
              >
                <span
                  role="button"
                  tabIndex={0}
                  className="edit-desc-icon"
                  onClick={this.openProperiesModal}
                >
                  <i className="fa fa-edit" />
                </span>
              </TooltipWrapper>
            </span>
          </AuthWrapper>
        )}
        {this.props.chart.sliceFormData && (
          <AlteredSliceTag
            origFormData={this.props.chart.sliceFormData}
            currentFormData={formData}
          />
        )}
        <div className="pull-right noPadding">
          {chartFinished && queryResponse && (
            <RowCountLabel
              rowcount={queryResponse.rowcount}
              limit={formData.row_limit}
              customPolling={customPolling}
            />)}
          {chartFinished && queryResponse && queryResponse.is_cached && (
            <CachedLabel
              onClick={this.postChartFormData.bind(this)}
              cachedTimestamp={queryResponse.cached_dttm}
            />
          )}
          <Timer
            startTime={chartUpdateStartTime}
            endTime={chartUpdateEndTime}
            isRunning={chartStatus === 'loading'}
            status={CHART_STATUS_MAP[chartStatus]}
            style={{ marginRight: '5px' }}
            {...this.props}
            customPolling={customPolling}
          />
          {!chartFinished || this.props.chart.isPolling && (
            <InfoTooltipWithTrigger
              label='timer'
              tooltip={'While processing this timer includes the queuing time which you are not billed for.'}
            />
          )}
        </div>
      </div>
    );
  }
}

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ sliceUpdated }, dispatch);
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
