# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import simplejson as json
import pandas as pd
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset import app
from superset.extensions import celery_app
from ludwig.api import LudwigModel
import numpy as np


def makeCorrectName(s):
    return s.replace(' ', '_')


def returnDataTable(df):
    exdata = json.loads(df.to_json(orient="table"))
    for item in exdata["data"]:
        if "index" in item:
            del item["index"]
    exdata["schema"]["fields"].pop(0)
    return exdata


@celery_app.task(bind=True, 
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def classification(self, datasource_id, nameValue):
    self.update_state(state="PROCESSING")
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    engine = db.get_sqla_engine()
    pd_table = pd.read_sql_table(nameTb, engine)

    # Copy new dataframe
    new_pd_table = pd_table.copy()

    # Rename datafram
    columns = list(pd_table.columns)
    for c in columns:
        new_pd_table = new_pd_table.rename(columns={c: makeCorrectName(c)})
    new_nameValue = makeCorrectName(nameValue)

    # DROP null predicted value
    pd_table_train = new_pd_table[pd.notnull(new_pd_table[new_nameValue])]
    pd_table_test = new_pd_table[pd.isnull(new_pd_table[new_nameValue])]

    # Train code

    # Get type column
    new_columns = list(pd_table_train.columns)
    dtypes = []
    for c in new_columns:
        dtypes.append(pd_table_train[c].dtype)
    dtypes2 = []
    for d in dtypes:
        if d in ('int64', 'float64'):
            dtypes2.append('numerical')
        if d == object:
            dtypes2.append('category')
        if d == bool:
            dtypes2.append('binary')
        if d == np.dtype('datetime64[ns]'):
            dtypes2.append('date')

    input_features = []
    for col, dtype in zip(new_columns, dtypes2):
        if dtype == 'date':
            pd_table_train = pd_table_train.drop(columns=[col])
        else:
            input_features.append(dict(name=col, type=dtype))
    for index, item in enumerate(input_features):
        if item['name'] == new_nameValue:
            typePredict = input_features.pop(index)['type']
    model_definition = {
        'input_features': input_features,
        'output_features': [
            {'name': new_nameValue, 'type': typePredict}
        ]
    }
    model = LudwigModel(model_definition)
    model.train(data_df=pd_table_train,
                output_directory=app.config["MINDSDB_STORAGE_PATH"])

    # Prediction
    predictions = model.predict(pd_table_test)
    rows, cols = predictions.shape
    pd_table_predict = pd_table[pd.isnull(pd_table[nameValue])]
    if rows > 0:
        pd_table_predict = pd_table_predict.reset_index()
        pd_table_predict[nameValue] = predictions

    pd_data = pd_table[pd.notnull(pd_table[nameValue])]
    pd_data = returnDataTable(pd_data)
    print(
        {"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})

    return ({"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})


@celery_app.task(bind=True, 
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def regression(self, datasource_id, nameValue):
    self.update_state(state="PROCESSING")
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    engine = db.get_sqla_engine()
    pd_table = pd.read_sql_table(nameTb, engine)

    # Copy new dataframe
    new_pd_table = pd_table.copy()

    # Rename datafram
    columns = list(pd_table.columns)
    for c in columns:
        new_pd_table = new_pd_table.rename(columns={c: makeCorrectName(c)})
    new_nameValue = makeCorrectName(nameValue)

    # DROP null predicted value
    pd_table_train = new_pd_table[pd.notnull(new_pd_table[new_nameValue])]
    pd_table_test = new_pd_table[pd.isnull(new_pd_table[new_nameValue])]

    # Train code

    # Get type column
    new_columns = list(pd_table_train.columns)
    dtypes = []
    for c in new_columns:
        dtypes.append(pd_table_train[c].dtype)
    dtypes2 = []
    for d in dtypes:
        if d in ('int64', 'float64'):
            dtypes2.append('numerical')
        if d == object:
            dtypes2.append('category')
        if d == bool:
            dtypes2.append('binary')
        if d == np.dtype('datetime64[ns]'):
            dtypes2.append('date')

    input_features = []
    for col, dtype in zip(new_columns, dtypes2):
        if dtype == 'date':
            pd_table_train = pd_table_train.drop(columns=[col])
        else:
            input_features.append(dict(name=col, type=dtype))
    for index, item in enumerate(input_features):
        if item['name'] == new_nameValue:
            typePredict = input_features.pop(index)['type']
    model_definition = {
        'input_features': input_features,
        'output_features': [
            {'name': new_nameValue, 'type': typePredict}
        ]
    }
    model = LudwigModel(model_definition)
    model.train(data_df=pd_table_train,
                output_directory=app.config["MINDSDB_STORAGE_PATH"])

    # Prediction
    predictions = model.predict(pd_table_test)
    rows, cols = predictions.shape
    pd_table_predict = pd_table[pd.isnull(pd_table[nameValue])]
    if rows > 0:
        pd_table_predict = pd_table_predict.reset_index()
        pd_table_predict[nameValue] = predictions

    pd_data = pd_table[pd.notnull(pd_table[nameValue])]
    pd_data = returnDataTable(pd_data)
    print(
        {"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})

    return ({"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})