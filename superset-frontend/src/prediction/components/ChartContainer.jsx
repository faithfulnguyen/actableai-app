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
import Loading from 'src/components/Loading';

const propTypes = {
	train: PropTypes.object,
	result: PropTypes.object,
};

export default class ChartContainer extends React.Component {
	constructor(props) {
    super(props);
    this.state = {
      add :  [],
      num: 0,
    }
  }

  addLine() {
    this.setState({ num: this.state.num + 1 });
    const newRow = this.state.add.concat({line: this.state.num})
    this.setState({ add: newRow });
  }

  header(header){
      return(
        <tr>
          {header.map(function(th,i){
           return <th key={`th${i}`}>{th}</th>
          })}
        </tr>
      );
  }

  rows(data,header,predictValue,isPredict){
    return(
      data.map(function(row,i){
        return(
          <tr key={`tr${i}`}>
            {header.map(function (index,i){
              return <td className={(isPredict && index===predictValue)?'prediction':''} key={`td${i}`}>{row[index]}</td>
            })}
          </tr>
        );
      })
    );
  }

  addRow(add,header,predictValue,key){
    return(
      add.map(function(row,i){
        const count = i;
        return(
        <tr key={`tr${i}`} className="row-add">
          {header.map(function (index,i){
            return(
              predictValue === index ? (
                <td key={`td${i}`} className="prediction">{add[count]===undefined?'':add[count][predictValue]}</td>
              ) : (
                  <td key={`td${i}`}><input className="form-control" name={index} index={count} onChange={key.onChange.bind(key)} value={add[count][index]} /></td>
                )
            );
          })}
        </tr>
        );
      })
        );
  }

  onChange(event) {
    const name = event.target.name;
    const value = event.target.value;
    const index = event.target.attributes.getNamedItem('index').value;
    let add = this.state.add;
    add[index][name] = value;
    this.setState({ add: add });
    this.props.actions.updateInputData(add);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const predict = this.props.trainValue.predictValue;
    const nextPredict = nextProps.trainValue.predictValue;
    // delete add row when change Predicting Variable
    if(predict !== nextPredict){
      this.setState({ add: [] });
      this.props.actions.updateInputData([]);
      return true;
    }
    // update data add row after predict data
    if (this.state === nextState) {
      const { result, trainValue } = nextProps;
      if (result !== undefined){
        let state = this.state.add;
        Object.keys(result).map(function(key){
          if (state[key] !== undefined){
            state[key][trainValue.predictValue] = result[key];
          }
        });
        this.setState({ add: state });
      }
    }
    return true;
  }

  render() {
  	const { train, result, trainValue, loading} = this.props;
    // loading data train && predict
    if (loading){
      return <div className="text-center" id="predict-container">
        {<loading size={50} />}
      </div>;
    }
    // return emty data
  	if (train === undefined || !trainValue.predictValue){
  		return (<div id="predict-container"></div>);
  	}else if (train.fields === undefined){
      return (<div id="predict-container" className="panel-body"><div className="alert alert-warning">No data</div></div>);
    }
    // get header & Predicting Variable
  	let header = train.fields;
    const predictValue = trainValue.predictValue;
  	header = header.map(value =>value.name);
    // return table predict
    return (
       <div className="panel panel-default" id="predict-container">
        <div className="panel-heading">
          <button id="addBtn" className="btn-blue btn btn-default" onClick={this.addLine.bind(this)}><span className="glyphicon glyphicon-plus"></span>ADD</button>
        </div>
        <div className="panel-body">
          <div className="table-content">
            <table id="table-prediction">
              <thead>
                {this.header(header)}
              </thead>
              <tbody>
                {this.rows(train.exdata,header,predictValue,false)}
                {this.rows(train.predictData,header,predictValue,true)}
                {this.addRow(this.state.add,header,predictValue,this)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;