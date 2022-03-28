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
import { OverlayTrigger, Tab, Tabs, Tooltip } from 'react-bootstrap';
import DataList from './DataContainer';
import AnalysisName from './AnalysisName';
import moment from 'moment';
import $ from 'jquery';
import DescriptionIcon from 'src/svg/DescriptionIcon';
import styled from 'styled-components';
import DescriptionModal from 'src/components/Modal/DescriptionModal';
import GtagEvent from 'src/components/GtagEvent';

const StyledTooltip = styled(Tooltip)`
  & > div.tooltip-inner {
    max-height: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const propTypes = {
};

export default class AddContentContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dataset: {},
      chart: {},
      dashboard: {},
      selectedTab: this.getSelectedTab(),
    };
  }

  handleSelect(selectedTab){
    this.setState({
      selectedTab
    });
    window.location.hash = selectedTab;
    $('.top-menu').closest('li').removeClass('menu-active');
    $(`#top-menu-${selectedTab}-button`).closest('li').addClass('menu-active');
  } 

  componentDidMount(){
    window.addEventListener('hashchange', e => {
      this.setState({
        selectedTab: this.getSelectedTab()
      })
    });
  }

  getSelectedTab() {
    return (window.location.hash || '#').substring(1);
  }
  
  render() {
    return (
        <Tabs
          className="withSearchBar"
          activeKey={this.state.selectedTab ? this.state.selectedTab : 'analytics'}
          onSelect={e => this.handleSelect(e)}
          defaultActiveKey="analytics"
          id="tab-content"
        >
          <Tab eventKey="data" title="Data">
            <DataList
              api="/api/v1/dataset/"
              placeholder="Type search data by Table Name ..."
              dataType="dataset"
              header={[
                {
                  id: 1,
                  name: 'Datasets',
                  selector: row => row.table_name,
                  order_column: 'table_name',
                  cell: row => (
                    <a target="_blank" href={row.explore_url}>
                      {row.table_name}
                    </a>
                  ),
                  sortable: true,
                },
                {
                  id: 2,
                  name: 'Database',
                  selector: row => row.database_name,
                  order_column: 'database_name',
                  cell: row => row.database_name,
                  sortable: true,
                },
                {
                  id: 3,
                  name: 'Creator',
                  selector: row => row.created_by_name,
                  order_column: 'created_by_name',
                  cell: row => (
                    <>
                      {!row.created_by_url && <>{row.created_by_name}</>}
                      {row.created_by_url && (
                        <a href={row.created_by_url}>{row.created_by_name}</a>
                      )}
                    </>
                  ),
                  sortable: true,
                },
                {
                  id: 4,
                  name: 'Modified',
                  selector: row => row.changed_on,
                  order_column: 'changed_on',
                  cell: row => moment(row.changed_on).format('D/M/YY'),
                  sortable: true,
                },
                {
                  id: 5,
                  name: 'Created',
                  selector: row => row.created_on,
                  order_column: 'created_on',
                  cell: row => moment(row.created_on).format('D/M/YY'),
                  sortable: true,
                },
                {
                  id: 6,
                  name: 'Is Public',
                  selector: row => row.is_public,
                  order_column: 'is_public',
                  cell: row => {
                    if (row.is_example || row.created_by_name === 'Anonymous') {
                      return '';
                    } else {
                      return row.is_public ? 'True' : 'False';
                    }
                  },
                  sortable: true,
                },
                {
                  id: 7,
                  name: 'Description',
                  selector: row => row.description,
                  order_column: 'description',
                  cell: row =>
                    row.description || row.can_edit ? (
                      <div onClick={row.onDescriptionClick}>
                        <DescriptionIcon />
                      </div>
                    ) : (
                      <></>
                    ),
                  sortable: true,
                },
              ]}
              actions={{
                id: 8,
                linkEdit: '/tablemodelview/edit/',
                linkDelete: '/api/v1/dataset/',
                linkClone: '/api/v1/dataset/clone',
                linkDownload: '/api/v1/dataset/download',
                typeDownload: 'DATASET',
              }}
            />
          </Tab>
          <Tab eventKey="analytics" title="Analytics">
            <DataList
              api="/api/v1/chart/"
              placeholder="Type search data by Name ..."
              dataType="chart"
              header={[
                {
                  id: 1,
                  name: 'Analytics',
                  selector: row => row.slice_name,
                  order_column: 'slice_name',
                  cell: row => (
                    <GtagEvent
                      onClick={() => { window.open(row.url, '_blank')}}
                      eventLabel={`Open Analysis: ${row.slice_name}`}
                    >
                      <a href="/#">{row.slice_name}</a>
                    </GtagEvent>
                  ),
                  sortable: true,
                },
                {
                  id: 2,
                  name: 'Analysis Type',
                  selector: row => AnalysisName[row.viz_type],
                  order_column: 'viz_type',
                  sortable: true,
                },
                {
                  id: 3,
                  name: 'Dataset',
                  selector: row => row.datasource_name_text,
                  order_column: 'datasource_name_text',
                  cell: row => (
                    <a href={row.datasource_url}>{row.datasource_name_text}</a>
                  ),
                  sortable: true,
                },
                {
                  id: 4,
                  name: 'Creator',
                  selector: row => row.created_by_name,
                  order_column: 'created_by_name',
                  cell: row => (
                    <>
                      {!row.created_by_url && (
                        <>
                          {row.created_by_name && !row.is_example
                            ? row.created_by_name
                            : 'Actable AI'}
                        </>
                      )}
                      {row.created_by_url && (
                        <a href={row.created_by_url}>
                          {row.created_by_name && !row.is_example
                            ? row.created_by_name
                            : 'Actable AI'}
                        </a>
                      )}
                    </>
                  ),
                  sortable: true,
                },
                {
                  id: 5,
                  name: 'Modified',
                  selector: row => row.changed_on,
                  order_column: 'changed_on',
                  cell: row => moment(row.changed_on).format('D/M/YY'),
                  sortable: true,
                },
                {
                  id: 6,
                  name: 'Created',
                  selector: row => row.created_on,
                  order_column: 'created_on',
                  cell: row => moment(row.created_on).format('D/M/YY'),
                  sortable: true,
                },
                {
                  id: 7,
                  name: 'Description',
                  selector: row => row.description,
                  order_column: 'description',
                  cell: row =>
                    row.description || row.can_edit ? (
                      <div onClick={row.onDescriptionClick}>
                        <DescriptionIcon />
                      </div>
                    ) : (
                      <></>
                    ),
                  sortable: true,
                },
              ]}
              actions={{
                id: 8,
                linkEdit: '/chart/edit/',
                linkDelete: '/api/v1/chart/',
                linkClone: '/api/v1/chart/clone',
                linkDownload: '/api/v1/chart/download',
                typeDownload: 'CHART',
              }}
            />
          </Tab>
          <Tab eventKey="dashboards" title="Dashboards">
            <DataList
              api="/api/v1/dashboard/"
              placeholder="Type search data by Title ..."
              header={[
                {
                  id: 1,
                  name: 'Dashboards',
                  selector: row => row.dashboard_title,
                  order_column: 'dashboard_title',
                  cell: row => <a href={row.url}>{row.dashboard_title}</a>,
                  sortable: true,
                },
                {
                  id: 2,
                  name: 'Published',
                  order_column: 'published',
                  selector: row => (row.published ? 'True' : 'False'),
                  sortable: true,
                },
                {
                  id: 3,
                  name: 'Public',
                  order_column: 'is_public',
                  selector: row => (row.is_public ? 'True' : 'False'),
                  sortable: true,
                },
                {
                  id: 4,
                  name: 'Creator',
                  selector: row => row.created_by_name,
                  order_column: 'created_by_name',
                  cell: row => (
                    <>
                      {!row.created_by_url && (
                        <>
                          {row.created_by_name && !row.is_example
                            ? row.created_by_name
                            : 'Actable AI'}
                        </>
                      )}
                      {row.created_by_url && (
                        <a href={row.created_by_url}>
                          {row.created_by_name && !row.is_example
                            ? row.created_by_name
                            : 'Actable AI'}
                        </a>
                      )}
                    </>
                  ),
                  sortable: true,
                },
                {
                  id: 5,
                  name: 'Modified',
                  selector: row => row.changed_on,
                  order_column: 'changed_on',
                  cell: row => moment(row.changed_on).format('D/M/YY'),
                  sortable: true,
                },
                {
                  id: 6,
                  name: 'Created',
                  selector: row => row.created_on,
                  order_column: 'created_on',
                  cell: row => moment(row.created_on).format('D/M/YY'),
                  sortable: true,
                },
              ]}
              actions={{
                id: 7,
                linkEdit: '/dashboard/edit/',
                linkDelete: '/api/v1/dashboard/',
              }}
            />
          </Tab>
        </Tabs>
    );
  }
}

AddContentContainer.propTypes = propTypes;
