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
import { Button, Panel, Modal, Checkbox } from 'react-bootstrap';
import Cookies from 'universal-cookie';

const cookies = new Cookies();
const propTypes = {
  
};

export default class WalkthroughContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showByCookie: false,
      showBySession: false,
      // showByCookie: !cookies.get("walkthrough"),
      // showBySession: sessionStorage.getItem("walkthrough") === null ? true : false,//show popup the first load page
    };

    this.handleClose = this.handleClose.bind(this);

  }

  handleClose(){
    sessionStorage.setItem("walkthrough",false);
    this.setState({showByCookie:false});
  }

  handleCheckboxChange(event) {
    const target = event.target
    const checked = target.checked
    const name = target.name
    let d = new Date();
    const minutes = 60*24*60;//days*hours*minutes
    d.setTime(d.getTime() + (minutes*60*1000));
    cookies.set(name, checked, {path: "/", expires: d});
  }

  render() {
    return (
      <>
        <Modal show={this.state.showByCookie && this.state.showBySession} onHide={this.handleClose} id="walkthrough">
          <Modal.Header closeButton>
            <Modal.Title>Walkthrough tours</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="col-md-12 form-group">
              Click on one of the boxes for a guided tour of how to use the selected feature
            </div>
            <div className="tab-content">
              <div id="page1" className="tab-pane fade in active">
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/correlational_analysis?nclose=true" target="_blank">
                    <img alt="Correlational Analysis" width="100%" className="image-selector " src="/static/assets/images/walkthrough/correlatinal.png" />
                    <div className="text-title">Correlational Analysis</div>
                  </a>
                </div>
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/segmentation_analysis?nclose=true" target="_blank">
                    <img alt="Segmentation Analysis" width="100%" className="image-selector " src="/static/assets/images/walkthrough/segmentation.png" />
                    <div className="text-title">Segmentation Analysis</div>
                  </a>
                </div>
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/time_series_forecasting?nclose=true" target="_blank">
                    <img alt="Time-series forecasting" width="100%" className="image-selector " src="/static/assets/images/walkthrough/time-series.png" />
                    <div className="text-title">Time-series forecasting</div>
                  </a>
                </div>
              </div>
              <div id="page2" className="tab-pane fade">
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/regression?nclose=true" target="_blank">
                    <img alt="Regression" width="100%" className="image-selector " src="/static/assets/images/walkthrough/regression.png" />
                    <div className="text-title">Regression</div>
                  </a>
                </div>
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/table?nclose=true" target="_blank">
                    <img alt="Table" width="100%" className="image-selector " src="/static/assets/images/walkthrough/table.png" />
                    <div className="text-title">Table</div>
                  </a>
                </div>
                <div className="col-md-4">
                  <a href="https://overfit.nickelled.com/databses?nclose=true" target="_blank">
                    <img alt="Database" width="100%" className="image-selector " src="/static/assets/images/walkthrough/database.png" />
                    <div className="text-title">Database</div>
                  </a>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="row col-md-12">
              <ul className="nav nav-tabs col-md-6">
                <li className="active"><a data-toggle="tab" href="#page1">1</a></li>
                <li><a data-toggle="tab" href="#page2">2</a></li>
              </ul>
              <div className="row col-md-6 text-left">
                <Checkbox
                  name="walkthrough"
                  style={{display:"inline-block"}}
                  onChange={this.handleCheckboxChange} />
                <label className="title-checkbox">Don't display this again</label>
              </div>
            </div>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
}

WalkthroughContainer.propTypes = propTypes;
