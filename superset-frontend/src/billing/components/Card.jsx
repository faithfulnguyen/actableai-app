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
import moment from 'moment';
import { Button } from 'react-bootstrap';

const propTypes = {
  card: PropTypes.object
};

export default class Card extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { card, isDefault, onChooseCreditCard, isChoose, isDelete, onShowDeleteCreditCard } = this.props;
    return (
      <div className={`card ${isDefault && 'default'}`}>
        <div>
          <h6>{card.card.brand} xxxx-{card.card.last4}</h6>
          <p>Expires {card.card.exp_month}/{card.card.exp_year} • Created at {moment.unix(card.created).format('MMMM Do YYYY')}</p>
        </div>
        <div>
          {(isChoose && !isDefault) && <Button name="select" bsSize="small" onClick={() => onChooseCreditCard(card)}>Select</Button>}
          {isDefault && <Button bsStyle="primary" bsSize="small">Selected</Button>}
          {isDelete && <Button name="delete" onClick={() => onShowDeleteCreditCard(card)} bsStyle="warning" bsSize="small">Delete</Button>}
        </div>
      </div>
    )
  }
}

Card.propTypes = propTypes;
