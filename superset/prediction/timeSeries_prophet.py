from superset.extensions import celery_app
from fbprophet import Prophet
import pandas as pd
import numpy as np
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.prediction.util import *

@celery_app.task(bind=True, 
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def timeseries_prediction(self, datasource_id, date_column, predicted_column,
                          periods):
    # db_uri = conf.get("SQLALCHEMY_EXAMPLES_URI") \
    # or conf.get("SQLALCHEMY_DATABASE_URI")
    # db = get_or_create_db(name_database, db_uri)
    # engine = db.get_sqla_engine()
    # pd_table = pd.read_sql_table(name_table, engine)
    self.update_state(state="PROCESSING")
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    engine = db.get_sqla_engine()
    pd_table = pd.read_sql_table(nameTb, engine)

    pd_table = pd_table.sort_values(by=[date_column])
    modelTimeSeries = Prophet(seasonality_mode='multiplicative')
    modelTimeSeries.fit(pd_table.reset_index().rename(
        columns={date_column: 'ds', predicted_column: 'y'}))

    periods = int(periods)
    freq = findFred(pd_table, date_column)

    pd_date = pd.to_datetime(pd_table[date_column]).sort_values()

    future = make_future_dataframe(periods,pd_date, freq,include_history=True)
    forecast = modelTimeSeries.predict(future)
    result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']][-1 * periods:]

    d_date = pd_table[date_column].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()
    d_value = pd_table[predicted_column].tolist()
    p_date = result['ds'].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()
    p_value = result['yhat'].tolist()
    _min = result['yhat_lower'].tolist()
    _max = result['yhat_upper'].tolist()

    return {
        "status": "SUCCESS",
        "data": {"date": d_date[-5 * periods:], "value": d_value[-5 * periods:]},
        "prediction": {
            "date": p_date, "min": _min, "max": _max, "median": p_value}
    }


