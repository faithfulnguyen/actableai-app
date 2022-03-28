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

from superset.extensions import celery_app
from mindsdb import Predictor


@celery_app.task(bind=True, 
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def regressionAndClassification(self, datasource_id, nameValue, userId):
    self.update_state(state="PROCESSING")
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    engine = db.get_sqla_engine()
    pd_table = pd.read_sql_table(nameTb, engine)

    # DROP null predicted value
    pd_table_train = pd_table[pd.notnull(pd_table[nameValue])]
    pd_table_test = pd_table[pd.isnull(pd_table[nameValue])]

    # Train code
    mdb = Predictor(name=str(self.request.id))
    mdb.learn(from_data=pd_table_train, to_predict=nameValue)
    predictor = Predictor(name=str(self.request.id))

    # path = os.path.join("storage", userId, nameTb, nameValue)
    # if not os.path.exists(path):
    #     os.makedirs(path)

    # predictor.export_model(model_name=path + "/model")

    # Save model

    # path = os.path.join("storage", userId, nameTb, nameValue, "model.zip")
    # Load model
    # predictor = Predictor(name="test")
    # predictor.load(mindsdb_storage_dir=path)
    # print("Loading model ... OK")

    # Prediction
    json_test_table = json.loads(pd_table_test.to_json(orient="records"))
    for i in range(0, len(json_test_table)):
        result = predictor.predict(when=json_test_table[i])
        json_test_table[i][nameValue] = result[0][nameValue]

    exdata = json.loads(pd_table_train.tail(7).to_json(orient="table"))
    for item in exdata["data"]:
        if "index" in item:
            del item["index"]
    exdata["schema"]["fields"].pop(0)
    return ({"status": "SUCCESS", "fields": exdata["schema"]["fields"],
            "exdata": exdata["data"], "predictData": json_test_table})
