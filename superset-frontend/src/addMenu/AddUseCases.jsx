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
import Select from 'react-virtualized-select';
import { t } from '@superset-ui/translation';
import { Modal } from 'react-bootstrap';
import _ from 'lodash';

const propTypes = {
  datasources: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const subMenu = [
  {type: "plotly_prediction", name: "Demand Forecasting"},
  {type: "regression_prediction", name: "Sales Prediction"},
  {type: "classification_prediction", name: "Churn Prediction"},
  {type: "plotly_tsne", name: "Customer Segmentation"},
  {type: "classification_prediction", name: "Credit Default Prediction"},
  {type: "plotly_prediction", name: "Stock Price Forecasting"},
  {type: "plotly_prediction", name: "Energy Consumption Forecasting"},
];
let title = "Choose a datasource";

export default class AddUseCases extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      visType: null,
      datasources: this.props.datasources,
      show: false,
      datasourceValue: null,
    };

    this.changeDatasource = this.changeDatasource.bind(this);
    this.changeVisType = this.changeVisType.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  exploreUrl(datasourceValue) {
    const formData = encodeURIComponent(
      JSON.stringify({
        newChart: true,
        viz_type: this.state.visType,
        datasource: datasourceValue,
      }),
    );
    return `/superset/explore/?form_data=${formData}`;
  }

  changeDatasource(e) {
    this.setState({ datasourceValue: e.value });
    window.location.href = this.exploreUrl(e.value);
  }

  changeVisType(name,visType) {
    title = name;
    const dataList = [];
    const { datasources } = this.props;
    datasources.forEach(datasource => {
      if (_.includes(datasource.conform_chart, visType)) {
        dataList.push(datasource);
      }
    });
    this.setState({ visType, datasources: dataList, show: true });
  }

  handleClose() {
    this.setState({ show: false });
  }

  render() {
    return (
      <div>
        <Modal show={this.state.show} onHide={this.handleClose} id="popup-add-useCases">
          <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{
            height: 380}}>
            <div className="col-md-12 box-group">
              <label className="title">Please select a data source or upload your data</label>
              <Select
                clearable={false}
                ignoreAccents={false}
                name="select-datasource"
                className="form-group"
                onChange={this.changeDatasource}
                options={this.state.datasources}
                placeholder={`${this.state.datasources.length} option(s)`}
                value={this.state.datasourceValue}
                width={600}
              />
            </div>
            <div className="col-md-12 box-group">
              <label className="title">Or create a new data source</label>
              <a href="/csvtodatabaseview/form" target="_blank">Upload a CSV</a>
              <a href="/exceltodatabaseview/form" target="_blank" className="right">Upload an Excel file</a>
              <a href="/databaseview/list/" target="_blank">Connect to Database</a>
              <a href="/superset/sqllab" target="_blank" className="right">Create a SQL view</a>
            </div>
          </Modal.Body>
        </Modal>
        {
          subMenu.map((item,i) => 
          <li key={i}>
            <a onClick={() => this.changeVisType(item.name,item.type)}>
              <span>{item.name}</span>
            </a>
          </li>
          )
        }
      </div>
    );
  }
}

AddUseCases.propTypes = propTypes;
