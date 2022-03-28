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
import cx from 'classnames';
import { t } from '@superset-ui/translation';

import URLShortLinkButton from '../../components/URLShortLinkButton';
import EmbedCodeButton from './EmbedCodeButton';
import { exportChart, getExploreLongUrl } from '../exploreUtils';
import ModalTrigger from '../../components/ModalTrigger';
import AuthWrapper from 'src/components/AuthWrapper';

const propTypes = {
  actions: PropTypes.object.isRequired,
  canDownload: PropTypes.oneOfType([PropTypes.string, PropTypes.bool])
    .isRequired,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object,
  queryResponse: PropTypes.object,
  slice: PropTypes.object,
  renderAddTableModal: PropTypes.node,
};

export default function ExploreActionButtons({
  actions,
  canDownload,
  chartStatus,
  latestQueryFormData,
  queryResponse,
  slice,
  renderAddTableModal,
}) {
  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    'disabled disabledButton': !canDownload,
  });
  const doExportCSV = exportChart.bind(this, latestQueryFormData, 'csv');
  const doExportChart = exportChart.bind(this, latestQueryFormData, 'json');

  return (
    <div className="btn-group results" role="group">
      {latestQueryFormData && (
        <URLShortLinkButton
          url={getExploreLongUrl(latestQueryFormData)}
          emailSubject="Superset Chart"
          emailContent="Check out this chart: "
        />
      )}

      {/* {latestQueryFormData && (
        <EmbedCodeButton latestQueryFormData={latestQueryFormData} />
      )} */}

      {/* {latestQueryFormData && (
        <a
          onClick={doExportChart}
          className="btn btn-default btn-sm"
          title={t('Export to .json')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa fa-file-code-o" />&nbsp;
        </a>
      )} */}
      {latestQueryFormData && chartStatus === 'success' && (
        <AuthWrapper className="btn-group results" role="group" style={{ cursor: chartStatus === 'success' ? 'auto' : 'not-allowed' }}>
          <ModalTrigger
            isButton
            animation
            title={t('Save the dataset')}
            triggerNode={<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1.5" y="1.5" width="47" height="47" stroke="#F2F4F8" strokeWidth="3"/>
              <path d="M20 15V30C20 30.663 20.2634 31.2989 20.7322 31.7678C21.2011 32.2366 21.837 32.5 22.5 32.5H32.5C33.163 32.5 33.7989 32.2366 34.2678 31.7678C34.7366 31.2989 35 30.663 35 30V19.0525C35 18.7194 34.9334 18.3898 34.8041 18.0828C34.6749 17.7758 34.4857 17.4978 34.2475 17.265L30.1038 13.2125C29.6367 12.7558 29.0095 12.5001 28.3563 12.5H22.5C21.837 12.5 21.2011 12.7634 20.7322 13.2322C20.2634 13.7011 20 14.337 20 15V15Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M30 32.5V35C30 35.663 29.7366 36.2989 29.2678 36.7678C28.7989 37.2366 28.163 37.5 27.5 37.5H17.5C16.837 37.5 16.2011 37.2366 15.7322 36.7678C15.2634 36.2989 15 35.663 15 35V21.25C15 20.587 15.2634 19.9511 15.7322 19.4822C16.2011 19.0134 16.837 18.75 17.5 18.75H20" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>}
            modalTitle={t('Save table')}
            bsSize="large"
            modalBody={renderAddTableModal}
            customClass={'explore-chart-custom-button'}
          />
          <a
            onClick={doExportCSV}
            className={exportToCSVClasses}
            title={t('Export the data as a CSV file')}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g opacity="0.5">
            <rect x="1.5" y="1.5" width="47" height="47" stroke="#F2F4F8" strokeWidth="3"/>
            <path d="M11 32.9412V36.4706C11 37.4066 11.3718 38.3044 12.0337 38.9662C12.6956 39.6281 13.5934 40 14.5294 40H35.7059C36.6419 40 37.5397 39.6281 38.2016 38.9662C38.8634 38.3044 39.2353 37.4066 39.2353 36.4706V32.9412" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16.2949 22.353L25.1185 31.1766L33.942 22.353" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M25.1172 10V31.1765" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            </svg>
          </a>
        </AuthWrapper>
      )}
    </div>
  );
}

ExploreActionButtons.propTypes = propTypes;
