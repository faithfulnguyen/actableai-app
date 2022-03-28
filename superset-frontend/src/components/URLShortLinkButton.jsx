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
import { Popover, OverlayTrigger } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import CopyToClipboard from './CopyToClipboard';
import { getShortUrl } from '../utils/common';
import withToasts from '../messageToasts/enhancers/withToasts';

const propTypes = {
  url: PropTypes.string,
  emailSubject: PropTypes.string,
  emailContent: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
  placement: PropTypes.oneOf(['right', 'left', 'top', 'bottom']),
};

class URLShortLinkButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      shortUrl: '',
    };
    this.onShortUrlSuccess = this.onShortUrlSuccess.bind(this);
    this.getCopyUrl = this.getCopyUrl.bind(this);
  }

  onShortUrlSuccess(shortUrl) {
    this.setState(() => ({
      shortUrl,
    }));
  }

  getCopyUrl() {
    getShortUrl(this.props.url)
      .then(this.onShortUrlSuccess)
      .catch(this.props.addDangerToast);
  }

  renderPopover() {
    const emailBody = t('%s%s', this.props.emailContent, this.state.shortUrl);
    return (
      <Popover id="shorturl-popover">
        <CopyToClipboard
          text={this.state.shortUrl}
          copyNode={
            <i className="fa fa-clipboard" title={t('Copy to clipboard')} />
          }
        />
        &nbsp;&nbsp;
        <a
          href={`mailto:?Subject=${this.props.emailSubject}%20&Body=${emailBody}`}
        >
          <i className="fa fa-envelope" />
        </a>
      </Popover>
    );
  }

  render() {
    return (
      <OverlayTrigger
        trigger="click"
        rootClose
        shouldUpdatePosition
        placement={this.props.placement}
        onEnter={this.getCopyUrl}
        overlay={this.renderPopover()}
      >
        <span
          title={t('Copy the link')}
          className="short-link-trigger btn btn-default btn-sm"
          data-test="short-link-button"
        >
          <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="1.5" width="47" height="47" stroke="#F2F4F8" strokeWidth="3"/>
            <path d="M18.7504 31.25L31.2504 18.75M30.1566 13.025C30.6273 12.5543 31.2657 12.2898 31.9313 12.2896C32.597 12.2893 33.2355 12.5534 33.7066 13.0237L36.9766 16.295C37.2107 16.5275 37.3964 16.8039 37.5231 17.1085C37.6498 17.4131 37.715 17.7397 37.7148 18.0696C37.7147 18.3995 37.6493 18.7261 37.5224 19.0306C37.3955 19.3351 37.2096 19.6114 36.9754 19.8437L32.3441 24.475C31.8734 24.9457 31.235 25.2102 30.5694 25.2104C29.9037 25.2106 29.2652 24.9466 28.7941 24.4762L25.5254 21.205C25.2913 20.9725 25.1056 20.696 24.9789 20.3914C24.8522 20.0869 24.787 19.7602 24.7871 19.4303C24.7872 19.1005 24.8526 18.7739 24.9795 18.4694C25.1065 18.1649 25.2924 17.8885 25.5266 17.6562L30.1579 13.025H30.1566ZM17.6566 25.525C18.1273 25.0543 18.7657 24.7898 19.4313 24.7896C20.097 24.7893 20.7355 25.0534 21.2066 25.5237L24.4766 28.795C24.7107 29.0275 24.8964 29.3039 25.0231 29.6085C25.1498 29.9131 25.215 30.2397 25.2148 30.5696C25.2147 30.8995 25.1493 31.2261 25.0224 31.5306C24.8955 31.8351 24.7096 32.1114 24.4754 32.3437L19.8441 36.975C19.3734 37.4457 18.735 37.7102 18.0694 37.7104C17.4037 37.7106 16.7652 37.4466 16.2941 36.9762L13.0254 33.705C12.7913 33.4725 12.6056 33.196 12.4789 32.8914C12.3522 32.5869 12.287 32.2602 12.2871 31.9303C12.2872 31.6005 12.3526 31.2739 12.4795 30.9694C12.6065 30.6649 12.7924 30.3885 13.0266 30.1562L17.6579 25.525H17.6566Z" stroke="black" strokeWidth="2"/>
          </svg>
        </span>
      </OverlayTrigger>
    );
  }
}

URLShortLinkButton.defaultProps = {
  url: window.location.href.substring(window.location.origin.length),
  placement: 'left',
  emailSubject: '',
  emailContent: '',
};

URLShortLinkButton.propTypes = propTypes;

export default withToasts(URLShortLinkButton);
