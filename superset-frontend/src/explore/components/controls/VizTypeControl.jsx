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
import {
  Label,
  Row,
  Col,
  FormControl,
  Modal,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { getChartMetadataRegistry } from '@superset-ui/chart';

import ControlHeader from '../ControlHeader';
import './VizTypeControl.less';
import { DEFAULT_ORDER } from 'src/explore/consts';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => { },
};

const registry = getChartMetadataRegistry();

const IMAGE_PER_ROW = 6;
const LABEL_STYLE = { cursor: 'pointer' };

const typesWithDefaultOrder = new Set(DEFAULT_ORDER);

export default class VizTypeControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      filter: '',
    };
    this.toggleModal = this.toggleModal.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.focusSearch = this.focusSearch.bind(this);
  }

  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }

  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }

  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }

  changeSearch(event) {
    this.setState({ filter: event.target.value });
  }

  focusSearch() {
    if (this.searchRef) {
      this.searchRef.focus();
    }
  }

  renderItem(entry) {
    const { value } = this.props;
    const { key, value: type } = entry;
    const isSelected = key === value;

    return (
      <div
        className={`viztype-selector-container ${isSelected ? 'selected' : ''}`}
        onClick={this.onChange.bind(this, key)}
      >
        <img
          alt={type.name}
          width="100%"
          className={`viztype-selector ${isSelected ? 'selected' : ''}`}
          src={type.thumbnail}
        />
        <div className="viztype-label">{type.name}</div>
      </div>
    );
  }

  render() {
    const { filter, showModal } = this.state;
    const { value } = this.props;

    const filterString = filter.toLowerCase();
    const filteredTypes = DEFAULT_ORDER.filter(type => registry.has(type))
      .map(type => ({
        key: type,
        value: registry.get(type),
      }))
      .concat(
        registry.entries().filter(({ key }) => !typesWithDefaultOrder.has(key)),
      )
      .filter(entry => entry.value.name.toLowerCase().includes(filterString));

    const rows = [];
    for (let i = 0; i <= filteredTypes.length; i += IMAGE_PER_ROW) {
      rows.push(
        <Row key={`row-${i}`}>
          {filteredTypes.slice(i, i + IMAGE_PER_ROW).map(entry => (
            <Col md={12 / IMAGE_PER_ROW} key={`grid-col-${entry.key}`}>
              {this.renderItem(entry)}
            </Col>
          ))}
        </Row>,
      );
    }

    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id="error-tooltip">
              {t('Click to change analysis')}
            </Tooltip>
          }
        >
          <>
            <Label onClick={this.toggleModal} style={LABEL_STYLE}>
              {registry.has(value) ? registry.get(value).name : `${value}`}
            </Label>
            {!registry.has(value) && (
              <div className="text-danger">
                <i className="fa fa-exclamation-circle text-danger" />{' '}
                <small>{t('This analysis is not supported.')}</small>
              </div>
            )}
          </>
        </OverlayTrigger>
        <Modal
          show={showModal}
          onHide={this.toggleModal}
          onEnter={this.focusSearch}
          onExit={this.setSearchRef}
          bsSize="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>{t('Select an analysis')}</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{overflow: 'auto'}}>
            <div className="viztype-control-search-box">
              <FormControl
                inputRef={this.setSearchRef}
                type="text"
                value={filter}
                placeholder={t('Search')}
                onChange={this.changeSearch}
              />
            </div>
            {rows}
          </Modal.Body>
        </Modal>
      </div>
    );
  }
}

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;
