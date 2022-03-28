import simplejson as json
import pandas as
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset import app
from superset.extensions import celery_app
import numpy as np
from superset.prediction.regression import regression
from superset.prediction.classification_autogluon import classification_autogluon
from superset.prediction.util import isCategory

def makeCorrectName(s):
    return s.replace(' ', '_')


def returnDataTable(df):
    exdata = json.loads(df.to_json(orient="table"))
    exdata["schema"]["fields"].pop(0)
    return exdata


@celery_app.task(bind=True, 
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def regressionAndClassification(self, datasource_id, nameValue):
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

    if not isCategory(new_pd_table[new_nameValue]): #Regression
        predictions = regression(new_pd_table, new_nameValue)
    else: # Classification
        predictions = classification_autogluon(new_pd_table, new_nameValue)

    rows = predictions.shape[0] 
    pd_table_predict = pd_table[pd.isnull(pd_table[nameValue])]
    if rows > 0:
        pd_table_predict[nameValue] = predictions

    pd_data = pd_table[pd.notnull(pd_table[nameValue])].tail(7)
    pd_data = returnDataTable(pd_data)
    print(
        {"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})

    return ({"status": "SUCCESS", "fields": pd_data["schema"]["fields"],
            "exdata": pd_data['data'],
             "predictData": returnDataTable(pd_table_predict)['data']})
