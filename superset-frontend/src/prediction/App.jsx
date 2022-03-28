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
import { hot } from 'react-hot-loader';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import { Provider } from 'react-redux';

import App from './components/App';
import { initEnhancer } from '../reduxUtils';
import logger from '../middleware/loggerMiddleware';
import rootReducer from './reducers/index';
import getInitialState from './reducers/getInitialState';

import setupApp from '../setup/setupApp';

import './main.css';

setupApp();

const predictionViewContainer = document.getElementById('app');
const userViewContainer = document.getElementById('navbar-user-info');
const bootstrapData = JSON.parse(predictionViewContainer.getAttribute('data-bootstrap'));
const userId = JSON.parse(userViewContainer.getAttribute('data-id'));
const initState = getInitialState(bootstrapData, { id: userId });

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk),
    initEnhancer(false),
  ),
);

const Application = () => (
  <Provider store={store}>
    <App />
  </Provider>
);

export default hot(module)(Application);
