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
import React, { useEffect, useState } from 'react';
import Select from 'react-virtualized-select';
import { t } from '@superset-ui/translation';
import { Modal } from 'react-bootstrap';
import Carousel, { consts } from 'react-elastic-carousel';
import { getChartMetadataRegistry } from '@superset-ui/chart';
import _ from 'lodash';
import { SupersetClient } from '@superset-ui/connection';
import { DEFAULT_ORDER } from 'src/explore/consts';
import AuthWrapper from 'src/components/AuthWrapper';

const registry = getChartMetadataRegistry();

const typesWithDefaultOrder = new Set(DEFAULT_ORDER);

function AddAnalysisContainer() {
  const [vizType, setVizType] = useState(null);
  const [datasources, setDatasources] = useState([]);
  const [show, setShow] = useState(false);
  const [datasourceValue, setDatasourceValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const getDatasources = async () => {
    setLoading(true);
    const data = await SupersetClient.get({
      endpoint: `/api/v1/chart/list-datasource`
    });
    setDatasources(data?.json || [])
    setLoading(false);
  }

  useEffect(() => {
    if (show) {
      getDatasources();
    }
  }, [show]);
  

  const exploreUrl = (datasourceValue) => {
    const formData = encodeURIComponent(
      JSON.stringify({
        newChart: true,
        viz_type: vizType,
        datasource: datasourceValue,
      }),
    );
    return `/superset/explore/?form_data=${formData}`;
  }

  const changeDatasource = (e) =>  {
    setDatasourceValue(e.value);
    window.location.href = exploreUrl(e.value);
  }

  const changeVizType = (vizType) =>  {
    setVizType(vizType);
    setShow(true);
  }

  const handleClose = () => {
    setShow(false);
  }

  const renderItem = (entry) => {
    const { key, value: type } = entry;
    return (
      <div
        className={`slide-chart`}
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          padding: '0 10px',
          cursor: 'pointer',
          textAlign: 'center',
          borderLeft: key === 'plotly_bubble' ? '1px solid #D0D1D4' : undefined,
        }}
        onClick={() => changeVizType(key)}
        key={key}
      >
        <img
          draggable={false}
          alt={type.name}
          height="calc(100% - 20px)"
          width="80px"
          src={type.thumbnail}
        />
        <div className="title">
          {type.name}
        </div>
      </div>
    );
  }

  const renderArrow = ({ type, onClick, isEdge }) => {
    const disabled = isEdge ? 'disabled' : '';
    if(type === consts.PREV){
      return (
        <svg className={`rec-arrow rec rec-arrow-left ${disabled}`} onClick={onClick} width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 25C14.9723 25 17.389 24.2669 19.4446 22.8934C21.5002 21.5199 23.1024 19.5676 24.0485 17.2835C24.9946 14.9995 25.2421 12.4861 24.7598 10.0614C24.2775 7.63661 23.087 5.40933 21.3388 3.66117C19.5907 1.91301 17.3634 0.722506 14.9386 0.240191C12.5139 -0.242125 10.0005 0.00541687 7.71646 0.951511C5.43238 1.89761 3.48015 3.49976 2.10663 5.55538C0.733112 7.61099 0 10.0277 0 12.5C0.0037384 15.8141 1.3219 18.9913 3.66529 21.3347C6.00869 23.6781 9.18594 24.9963 12.5 25ZM12.5 1.00001C14.7745 1.00001 16.9979 1.67447 18.8891 2.9381C20.7802 4.20174 22.2542 5.9978 23.1246 8.09914C23.995 10.2005 24.2228 12.5128 23.779 14.7435C23.3353 16.9743 22.24 19.0234 20.6317 20.6317C19.0234 22.24 16.9743 23.3353 14.7435 23.779C12.5128 24.2228 10.2005 23.995 8.09914 23.1246C5.99779 22.2542 4.20173 20.7802 2.9381 18.8891C1.67446 16.9979 1 14.7745 1 12.5C1.00344 9.45107 2.21615 6.528 4.37207 4.37208C6.52799 2.21615 9.45106 1.00345 12.5 1.00001ZM8.6655 12.8716C8.61341 12.8247 8.57176 12.7674 8.54325 12.7034C8.51474 12.6394 8.50001 12.5701 8.50001 12.5C8.50001 12.4299 8.51474 12.3606 8.54325 12.2966C8.57176 12.2326 8.61341 12.1753 8.6655 12.1284L13.6655 7.62838C13.7642 7.54033 13.8937 7.49496 14.0257 7.50219C14.1578 7.50941 14.2816 7.56865 14.37 7.66694C14.4585 7.76522 14.5044 7.89455 14.4978 8.02662C14.4911 8.15869 14.4324 8.28274 14.3345 8.37163L9.74737 12.5L14.3345 16.6284C14.4324 16.7173 14.4911 16.8413 14.4978 16.9734C14.5044 17.1055 14.4585 17.2348 14.37 17.3331C14.2816 17.4314 14.1578 17.4906 14.0257 17.4978C13.8937 17.505 13.7642 17.4597 13.6655 17.3716L8.6655 12.8716Z" fill="#7D8EB6"/>
        </svg>
      );
    }else{
      return (
        <svg className={`rec-arrow rec rec-arrow-right ${disabled}`} onClick={onClick} width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C10.0277 0 7.61099 0.733112 5.55538 2.10663C3.49976 3.48015 1.89761 5.43238 0.951511 7.71646C0.00541586 10.0005 -0.242126 12.5139 0.24019 14.9386C0.722505 17.3634 1.91301 19.5907 3.66117 21.3388C5.40933 23.087 7.63661 24.2775 10.0614 24.7598C12.4861 25.2421 14.9995 24.9946 17.2835 24.0485C19.5676 23.1024 21.5199 21.5002 22.8934 19.4446C24.2669 17.389 25 14.9723 25 12.5C24.9963 9.18594 23.6781 6.00869 21.3347 3.66529C18.9913 1.3219 15.8141 0.00373855 12.5 0ZM12.5 24C10.2255 24 8.00211 23.3255 6.11095 22.0619C4.21978 20.7983 2.7458 19.0022 1.87539 16.9009C1.00498 14.7995 0.777245 12.4872 1.22097 10.2565C1.6647 8.02568 2.75997 5.97657 4.36828 4.36827C5.97658 2.75997 8.02568 1.6647 10.2565 1.22097C12.4872 0.777239 14.7995 1.00498 16.9009 1.87538C19.0022 2.74579 20.7983 4.21978 22.0619 6.11094C23.3255 8.00211 24 10.2255 24 12.5C23.9966 15.5489 22.7838 18.472 20.6279 20.6279C18.472 22.7838 15.5489 23.9966 12.5 24ZM16.3345 12.1284C16.3866 12.1753 16.4282 12.2326 16.4568 12.2966C16.4853 12.3606 16.5 12.4299 16.5 12.5C16.5 12.5701 16.4853 12.6394 16.4568 12.7034C16.4282 12.7674 16.3866 12.8247 16.3345 12.8716L11.3345 17.3716C11.2358 17.4597 11.1063 17.505 10.9743 17.4978C10.8422 17.4906 10.7184 17.4313 10.63 17.3331C10.5415 17.2348 10.4956 17.1054 10.5022 16.9734C10.5089 16.8413 10.5676 16.7173 10.6655 16.6284L15.2526 12.5L10.6655 8.37162C10.5676 8.28273 10.5089 8.15868 10.5022 8.02661C10.4956 7.89455 10.5415 7.76522 10.63 7.66693C10.7184 7.56865 10.8422 7.50941 10.9743 7.50218C11.1063 7.49496 11.2358 7.54033 11.3345 7.62837L16.3345 12.1284Z" fill="#7D8EB6"/>
        </svg>
      );
    }
  }
  
  const filteredTypes = (DEFAULT_ORDER.filter(type => registry.has(type))
    .map(type => ({
      key: type,
      value: registry.get(type),
    }))).concat(
      registry.entries().filter(({ key }) => !typesWithDefaultOrder.has(key)),
    );
  const breakPoints = [
    { width: 1, itemsToShow: 1, itemsToScroll: 1 },
  ];
  for(let i=2; i<16; i++){
    breakPoints.push({ width: 110*i, itemsToShow: i, itemsToScroll: i>2?3:1 });
  }

  const vizTypeDatasources = datasources.filter(datasource => _.includes(datasource.conform_chart, vizType));

  return (
    <AuthWrapper className="quickActions">
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Choose a datasource</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="select-datasource-slice">
            <Select
              clearable={false}
              ignoreAccents={false}
              name="select-datasource"
              className="form-group"
              onChange={changeDatasource}
              options={vizTypeDatasources}
              placeholder={`${vizTypeDatasources.length} option(s)`}
              value={datasourceValue}
            />
            {loading && <img className='loading' src='/static/assets/images/loading.gif' />}
          </div>

          <p className="text-muted">
            {t(
              'If the datasource you are looking for is not ' +
                'available in the list, ' +
                'follow the instructions on the how to add it on the ',
            )}
            <a href="https://docs.actable.ai/tutorial.html" target="_blank">
              {t('ActableAI tutorial')}
            </a>
          </p>
        </Modal.Body>
      </Modal>
      <div className="workflow1 actionList left">
        <ul>
          <li>
            <a href="/csvtodatabaseview/form">
              <img src="/static/assets/images/icon_csv.svg" alt="*"/>
              <span>Upload CSV</span>
            </a>
          </li>
          <li>
            <a href="/exceltodatabaseview/form" >
              <img src="/static/assets/images/icon_excel.svg" alt="*"/>
              <span>Upload Excel</span>
            </a>
          </li>
          <li>
            <a href="/superset/sqllab" >
              <img src="/static/assets/images/icon_sql_editor.svg" alt="*"/>
              <span>SQL Lab</span>
            </a>
          </li>
        </ul>
      </div>
      <div className="workflow2 analyticList">
        <Carousel
          breakPoints={breakPoints}
          renderArrow={renderArrow}
        >
          {filteredTypes.map(entry => renderItem(entry))}
        </Carousel>
      </div>
      <div className="workflow3 text-center actionList center">
        <a href="/dashboard/add">
          <img src="/static/assets/images/icon_dashboards.svg" alt="*"/>
          <br></br>
          <span>Dashboards</span>
        </a>
      </div>
      <div className="workflow4 actionList right">
        <ul>
            <li>
              <a href="/databaseview/list">
                <img src="/static/assets/images/icon_databases.svg" alt="*"/>
                <span>Databases</span>
              </a>
            </li>
            <li>
              <a href="/tablemodelview/add" >
                <img src="/static/assets/images/icon_connect_db.svg" alt="*"/>
                <span>Connect to Table</span>
              </a>
            </li>
            <li>
              <a href="/savedqueryview/list" >
                <img src="/static/assets/images/icon_saved_queries.svg" alt="*"/>
                <span>Saved Queries</span>
              </a>
            </li>
          </ul>
      </div>
    </AuthWrapper>
  );
}

export default AddAnalysisContainer;
