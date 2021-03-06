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
import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Modal,
  Row,
  Col,
  FormControl,
  FormGroup,
  // @ts-ignore
} from 'react-bootstrap';
// @ts-ignore
import Dialog from 'react-bootstrap-dialog';
import Select from 'react-select-5';
import { t } from '@superset-ui/translation';
import { SupersetClient, Json } from '@superset-ui/connection';
import Chart from 'src/types/Chart';
import getClientErrorObject from '../../utils/getClientErrorObject';

export type Slice = {
  slice_id: number;
  slice_name: string;
  description: string | null;
  cache_timeout: number | null;
};

type InternalProps = {
  slice: Slice;
  onHide: () => void;
  onSave: (chart: Chart) => void;
};

export type WrapperProps = InternalProps & {
  show: boolean;
  animation?: boolean; // for the modal
};

export default function PropertiesModalWrapper({
  show,
  onHide,
  animation,
  slice,
  onSave,
}: WrapperProps) {
  // The wrapper is a separate component so that hooks only run when the modal opens
  return (
    <Modal show={show} onHide={onHide} animation={animation} bsSize="large">
      <PropertiesModal slice={slice} onHide={onHide} onSave={onSave} />
    </Modal>
  );
}

type selectOption = {
  value: number,
  label: string
}

function PropertiesModal({ slice, onHide, onSave }: InternalProps) {
  const [submitting, setSubmitting] = useState(false);
  const errorDialog = useRef<any>(null);
  const [ownerOptions, setOwnerOptions] = useState<selectOption[]>([]);

  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [description, setDescription] = useState(slice.description || '');
  const [cacheTimeout, setCacheTimeout] = useState(
    slice.cache_timeout != null ? slice.cache_timeout : '',
  );
  const [owners, setOwners] = useState<any[] | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<any>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  function showError({ error, statusText }: any) {
    errorDialog.current.show({
      title: 'Error',
      bsSize: 'medium',
      bsStyle: 'danger',
      actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-danger')],
      body: error || statusText || t('An error has occurred'),
    });
  }

  async function fetchOwners() {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
      });
      const chart = (response.json as Json).result;
      const owners = chart.owners.map((owner: any) => ({
        value: owner.id,
        label: owner.username,
      }));
      setOwners(owners);
      setOwnerOptions(owners);

    } catch (response) {
      const clientError = await getClientErrorObject(response);
      showError(clientError);
    }
  }

  // get the owners of this slice
  useEffect(() => {
    fetchOwners();
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
      owners: owners!.map(o => o.value),
    };
    try {
      const res = await SupersetClient.put({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // update the redux state
      const updatedChart = {
        ...(res.json as Json).result,
        id: slice.slice_id,
      };
      onSave(updatedChart);
      onHide();
    } catch (res) {
      let clientError = {};
      if(res.status == 403) {
        clientError = {error: t("Sorry, you don't have permission to edit.")};
      }
      else {
        clientError = await getClientErrorObject(res);
      }
      showError(clientError);
    }
    setSubmitting(false);
  };

  const onChangeOwner = (value: any) => {
    setOwners(value)
  }

  const getOptionsAsync = async (newInput: any) => {
      if(newInput){
        const endpoint = '/superset/search_user' + `?email=${encodeURIComponent(newInput)}`;
        const result: any = await  SupersetClient.get({ endpoint: endpoint });
        let options = [];
        const selectedOwners  = owners||[]
        options = ownerOptions.filter( (item :selectOption)  => selectedOwners.includes(item.value));
        options.push({
          value: result.json.id,
          label: result.json.email
        });
        setIsLoading(false);
        setOwnerOptions(options);
      }
  }

  const onInputChange = (value: any) => {
    if (value) {
      setIsLoading(true);
      let timeout: null | ReturnType<typeof setTimeout> = null;
      timeout = setTimeout(() => getOptionsAsync(value), 3000);
      setTypingTimeout(timeout);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    }
    else {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Chart Properties</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6}>
            <h3>{t('Basic Information')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="name">
                {t('Name')}
              </label>
              <FormControl
                name="name"
                type="text"
                bsSize="sm"
                value={name}
                onChange={(event) => setName((event.target as any).value)}
              />
            </FormGroup>
            <FormGroup>
              <label className="control-label" htmlFor="description">
                {t('Description')}
              </label>
              <FormControl
                name="description"
                type="text"
                componentClass="textarea"
                bsSize="sm"
                value={description}
                onChange={(event) => setDescription((event.target as any).value)}
                style={{ maxWidth: '100%' }}
              />
              <p className="help-block">
                {t(
                  'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                )}
              </p>
            </FormGroup>
          </Col>
          <Col md={6}>
            <h3>{t('Configuration')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="cacheTimeout">
                {t('Cache Timeout')}
              </label>
              <FormControl
                name="cacheTimeout"
                type="text"
                bsSize="sm"
                value={cacheTimeout}
                onChange={(event) => setCacheTimeout((event.target as any).value.replace(/[^0-9]/, ''))}
              />
              <p className="help-block">
                {t(
                  'Duration (in seconds) of the caching timeout for this chart. Note this defaults to the datasource/table timeout if undefined.',
                )}
              </p>
            </FormGroup>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="owners">
                {t('Owners')}
              </label>
              <Select
                name="owners"
                isMulti
                isLoading={isLoading}
                value={owners || []}
                options={ownerOptions || []}
                onChange={onChangeOwner}
                isDisabled={!owners || !ownerOptions}
                onInputChange={onInputChange}
              />
              <p className="help-block">
                {t('A list of users who can alter the chart')}
              </p>
            </FormGroup>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button
          type="submit"
          bsSize="sm"
          bsStyle="primary"
          className="m-r-5"
          disabled={!owners || submitting}
        >
          {t('Save')}
        </Button>
        <Button type="button" bsSize="sm" onClick={onHide}>
          {t('Cancel')}
        </Button>
        <Dialog ref={errorDialog} />
      </Modal.Footer>
    </form>
  );
}
