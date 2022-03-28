from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def forecast_task(self,
                  datasource_id,
                  date_column,
                  predicted_columns,
                  prediction_length,
                  filters,
                  user_id,
                  trials,
                  table_head=1000):
    """
    TODO write documentation
    """
    self.update_state(state="PROCESSING")
    from superset import db
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset.filters import data_filters
    from actableai.tasks.forecast import AAIForecastTask
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset.billing.utils import add_billing_balance_history

    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    df = data_filters(
        datasource.table_name, datasource.database, datasource.schema, filters,
        order_by=date_column, columns=predicted_columns + [date_column], datasource_id=datasource_id)

    connect_to_ray()

    task = AAIForecastTask(
        use_ray=True,
        ray_params={
            "num_cpus": float(app.config["N_CPU_TIMESERIES"]),
            "num_gpus": float(app.config["N_GPU_TIMESERIES"])
        },
        optimize_memory_allocation=True,
        collect_memory_usage=True,
        optimize_gpu_memory_allocation=False,
        collect_gpu_memory_usage=True,
        resources_predictors_actor=get_resources_predictors_actor(),
        max_memory_offset=float(app.config["MEMORY_OPTIMIZER_OFFSET"]),
        optimize_memory_allocation_nrmse_threshold=float(app.config["MEMORY_OPTIMIZER_NRMSE_THRESHOLD"])
    )
    data = task.run(
        df,
        date_column,
        predicted_columns,
        prediction_length,
        float(app.config["RAY_CPU_PER_TRIAL"]),
        float(app.config["RAY_GPU_PER_TRIAL"]),
        int(app.config["RAY_MAX_CONCURRENT"]),
        trials=trials
    )

    data["table"] = df.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "plotly_prediction", data["runtime"], datasource)
    return data
