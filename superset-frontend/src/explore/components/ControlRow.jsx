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

const NUM_COLUMNS = 12;

const propTypes = {
  controls: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function ControlSetRow(props) {
  // const colSize = NUM_COLUMNS / props.controls.length;
  const controls = props.controls.filter(c => c);

  return (
    <div className={`row${controls.length > 0 ? ' space-1' : ''}`}>
      {controls.map((control, i) => (
        <div className={`col-lg-${NUM_COLUMNS} col-xs-12`} key={i} >
          {control}
        </div>
      ))}
    </div>
  );
}

ControlSetRow.propTypes = propTypes;
export default ControlSetRow;
