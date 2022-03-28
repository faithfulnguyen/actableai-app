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
import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import { t } from '@superset-ui/translation';

import shortid from 'shortid';
import { exportChart } from '../../explore/exploreUtils';
import * as actions from '../actions/sqlLab';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import Button from '../../components/Button';
import VizTypeControl from '../../explore/components/controls/VizTypeControl';

const propTypes = {
  actions: PropTypes.object.isRequired,
  query: PropTypes.object,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
  database: PropTypes.object.isRequired,
  saveQuery: PropTypes.object.isRequired,
  onUpdate: PropTypes.func,
};
const defaultProps = {
  query: {},
};

class ExploreResultsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.child = React.createRef();
    this.visualize = this.visualize.bind(this);
    this.onClick = this.onClick.bind(this);
    this.getInvalidColumns = this.getInvalidColumns.bind(this);
    this.renderInvalidColumnMessage = this.renderInvalidColumnMessage.bind(
      this,
    );
  }

  onClick() {
    const isSaved = !!this.props.saveQuery.remoteId;
    if (!isSaved) {
      this.props.actions.addDangerToast(
        t('You need to save your query before creating a chart.'),
      );
    } else {
      const timeout = this.props.timeout;
      // to disable check invalid column in sqllab, before explore chart from sqllab result
      // const msg = this.renderInvalidColumnMessage();
      const msg = null;
      if (Math.round(this.getQueryDuration()) > timeout) {
        this.dialog.show({
          title: t('Explore'),
          body: this.renderTimeoutWarning(),
          actions: [
            Dialog.CancelAction(),
            Dialog.OKAction(() => {
              this.child.current.toggleModal();
            }),
          ],
          bsSize: 'large',
          onHide: dialog => {
            dialog.hide();
          },
        });
      } else if (msg) {
        this.dialog.show({
          title: t('Explore'),
          body: msg,
          actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-primary')],
          bsSize: 'large',
          bsStyle: 'warning',
          onHide: dialog => {
            dialog.hide();
          },
        });
      } else {
        this.child.current.toggleModal();
      }
    }
  }

  getColumns() {
    const props = this.props;
    if (
      props.query &&
      props.query.results &&
      props.query.results.selected_columns
    ) {
      return props.query.results.selected_columns;
    }
    return [];
  }
  getQueryDuration() {
    return moment
      .duration(this.props.query.endDttm - this.props.query.startDttm)
      .asSeconds();
  }
  getInvalidColumns() {
    const re1 = /^[A-Za-z_]\w*$/; // starts with char or _, then only alphanum
    const re2 = /__\d+$/; // does not finish with __ and then a number which screams dup col name

    return this.props.query.results.selected_columns
      .map(col => col.name)
      .filter(col => !re1.test(col) || re2.test(col));
  }
  datasourceName() {
    const { query } = this.props;
    let datasourceName = shortid.generate();
    if (query) {
      datasourceName = `${query.tab}`;
    }
    return datasourceName;
  }
  buildVizOptions() {
    const { schema, sql, dbId, templateParams } = this.props.query;
    return {
      dbId,
      schema,
      sql,
      templateParams,
      datasourceName: this.datasourceName(),
      columns: this.getColumns(),
    };
  }

  queryPayload(tableId) {
    return {
      ...this.props.saveQuery,
      title: this.props.query.tab,
      description: this.props.query.tab,
      table_id: tableId,
    };
  }

  visualize(visType) {
    const hasTableId =
      !!this.props.saveQuery.tableId && this.props.saveQuery.tableId !== 'None';
    if (!hasTableId) {
      this.props.actions
        .createDatasource(this.buildVizOptions())
        .then(data => {
          this.props.onUpdate(this.queryPayload(data.table_id));
          const formData = {
            datasource: `${data.table_id}__table`,
            viz_type: visType,
          };
          // open new window for data visualization
          exportChart(formData);
        })
        .catch(err => {
          this.props.actions.addDangerToast(
            this.props.errorMessage ||
              t(
                'An error occurred, maybe the save query name has been existed.',
              ),
          );
        });
    } else {
      const formData = {
        datasource: `${this.props.saveQuery.tableId}__table`,
        viz_type: visType,
      };
      // open new window for data visualization
      exportChart(formData);
    }
  }

  renderTimeoutWarning() {
    return (
      <Alert bsStyle="warning">
        {t(
          'This query took %s seconds to run, ',
          Math.round(this.getQueryDuration()),
        ) +
          t(
            'and the explore view times out at %s seconds ',
            this.props.timeout,
          ) +
          t(
            'following this flow will most likely lead to your query timing out. ',
          ) +
          t(
            'We recommend your summarize your data further before following that flow. ',
          ) +
          t('If activated you can use the ')}
        <strong>CREATE TABLE AS </strong>
        {t('feature to store a summarized data set that you can then explore.')}
      </Alert>
    );
  }
  renderInvalidColumnMessage() {
    const invalidColumns = this.getInvalidColumns();
    if (invalidColumns.length === 0) {
      return null;
    }
    return (
      <div>
        {t('Column name(s) ')}
        <code>
          <strong>{invalidColumns.join(', ')} </strong>
        </code>
        {t('cannot be used as a column name. Please use aliases (as in ')}
        <code>
          SELECT count(*)
          <strong>AS my_alias</strong>
        </code>
        ){' '}
        {t(`limited to alphanumeric characters and underscores. Column aliases ending with
          double underscores followed by a numeric value are not allowed for reasons
          discussed in Github issue #5739.
          `)}
      </div>
    );
  }
  render() {
    const allowsSubquery =
      this.props.database && this.props.database.allows_subquery;
    return (
      <>
        <Button
          bsSize="small"
          onClick={this.onClick}
          disabled={!allowsSubquery}
        >
          <InfoTooltipWithTrigger
            icon="line-chart"
            placement="top"
            label="explore"
          />{' '}
          {t('Explore')}
        </Button>
        <Button className="hidden">
          <VizTypeControl
            ref={this.child}
            name="select-vis-type"
            onChange={this.visualize}
            value=""
          />
        </Button>
        <Dialog
          ref={el => {
            this.dialog = el;
          }}
        />
      </>
    );
  }
}
ExploreResultsButton.propTypes = propTypes;
ExploreResultsButton.defaultProps = defaultProps;

function mapStateToProps({ sqlLab, common }) {
  return {
    errorMessage: sqlLab.errorMessage,
    timeout: common.conf ? common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreResultsButton };
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreResultsButton);
