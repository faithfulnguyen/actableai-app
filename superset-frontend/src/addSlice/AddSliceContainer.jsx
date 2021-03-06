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
import { Button, Panel } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import { t } from '@superset-ui/translation';
import _ from 'lodash';

import VizTypeControl from '../explore/components/controls/VizTypeControl';

const propTypes = {
  datasources: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const styleSelectWidth = { width: 600 };

export default class AddSliceContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      visType: 'table',
      datasources: this.props.datasources
    };

    this.changeDatasource = this.changeDatasource.bind(this);
    this.changeVisType = this.changeVisType.bind(this);
    this.gotoSlice = this.gotoSlice.bind(this);
  }

  exploreUrl() {
    const formData = encodeURIComponent(
      JSON.stringify({
        newChart: true,
        viz_type: this.state.visType,
        datasource: this.state.datasourceValue,
      }),
    );
    return `/superset/explore/?form_data=${formData}`;
  }

  gotoSlice() {
    window.location.href = this.exploreUrl();
  }

  changeDatasource(e) {
    this.setState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1],
    });
  }

  changeVisType(visType) {
    const dataList = [];
    if (visType !== this.state.visType) {
      const { datasources } = this.props;
      datasources.forEach(datasource => {
        if (_.includes(datasource.conform_chart, visType)) {
          dataList.push(datasource);
        }
      });
      this.setState({ visType, datasources: dataList });
    }
  }

  isBtnDisabled() {
    return !(this.state.datasourceId && this.state.visType);
  }

  render() {
    return (
      <div className="container">
        <Panel>
          <Panel.Heading>
            <h3>{t('Create a new analytics')}</h3>
          </Panel.Heading>
          <Panel.Body>
            <div>
              <p>{t('Choose an analysis')}</p>
              <VizTypeControl
                  name="select-vis-type"
                  onChange={this.changeVisType}
                  value={this.state.visType}
              />
            </div>
            <br />
          <div>
            <p>{t('Choose a datasource')}</p>
            <div style={styleSelectWidth}>
              <Select
                clearable={false}
                ignoreAccents={false}
                name="select-datasource"
                onChange={this.changeDatasource}
                options={this.state.datasources}
                placeholder={`${this.state.datasources.length} option(s)`}
                style={styleSelectWidth}
                value={this.state.datasourceValue}
                width={600}
              />
            </div>
            <p className="text-muted">
              {t(
                'If the datasource you are looking for is not ' +
                  'available in the list, ' +
                  'follow the instructions on the how to add it on the ',
              )}
              <a href="https://docs.actable.ai/tutorial.html" target='_blank'>{t('ActableAI tutorial')}</a>
            </p>
          </div>
          <br />
          <hr />
          <Button
            bsStyle="primary"
            disabled={this.isBtnDisabled()}
            onClick={this.gotoSlice}
          >
            {t('Create new analytics')}
          </Button>
          <br />
          <br />
          </Panel.Body>
        </Panel>
      </div>
    );
  }
}

AddSliceContainer.propTypes = propTypes;
