from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app
from superset.billing.utils import add_billing_balance_history


@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def sentiment_task(self, datasource_id, target, filters, user_id=None, table_head=1000):
    import ray
    from superset import db, app
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset.filters import data_filters
    from superset.connectors.sqla.models import SqlaTable
    from actableai.tasks.sentiment_analysis import AAISentimentAnalysisTask

    self.update_state(state="PROCESSING")
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    schema = datasource.schema
    pd_table = data_filters(nameTb, db, schema, filters, columns=[target], datasource_id=datasource_id)

    connect_to_ray()

    task = AAISentimentAnalysisTask(
        use_ray=True,
        ray_params={
            "num_cpus": 1,
            "num_gpus": 0
        },
        optimize_memory_allocation=True,
        collect_memory_usage=True,
        optimize_gpu_memory_allocation=False,
        collect_gpu_memory_usage=True,
        resources_predictors_actor=get_resources_predictors_actor(),
        max_memory_offset=float(app.config["MEMORY_OPTIMIZER_OFFSET"]),
        optimize_memory_allocation_nrmse_threshold=float(app.config["MEMORY_OPTIMIZER_NRMSE_THRESHOLD"])
    )
    result = task.run(pd_table[[target]], target)

    if user_id is not None and result["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "sentiment_analysis", result["runtime"], datasource)

    return {
        "messenger": result.get("message", ""),
        "trace": result.get("trace", ""),
        "status": result["status"],
        "validations": [],
        "data": result.get("data", {}),
        "table": pd_table.head(table_head).to_dict(),
        "runtime": result.get("runtime"),
    }
