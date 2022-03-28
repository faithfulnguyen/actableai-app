import random
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError
from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def correlation_task(self,
                     datasource_id,
                     target_column,
                     columns,
                     filters,
                     target_value=None,
                     control_columns=None,
                     control_values=None,
                     top_k=20,
                     lr_chart_max_size=1000,
                     table_head=1000):
    """
    TODO write documentation
    """
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from actableai.tasks.correlation import AAICorrelationTask

    self.update_state(state="PROCESSING")

    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    schema = datasource.schema
    pd_table = data_filters(nameTb, db, schema, filters, columns=set(columns + [target_column]), datasource_id=datasource_id)

    connect_to_ray()

    task = AAICorrelationTask(
        use_ray=True,
        ray_params={
            "num_cpus": float(app.config["N_CPU_CORRELATION"]),
            "num_gpus": float(app.config["N_GPU_CORRELATION"])
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
        pd_table,
        target_column,
        target_value,
        control_columns=control_columns,
        control_values=control_values,
        top_k=top_k,
    )

    # Sample data points if there are too many data points in returned scatter plots
    down_sampled = False
    if "data" in data and "charts" in data["data"]:
        for chart in data["data"]["charts"]:
            if chart["type"] == "lr" and len(chart["data"]["x"]) > lr_chart_max_size:
                xy = list(zip(chart["data"]["x"] , chart["data"]["y"]))
                random.shuffle(xy)
                chart["data"]["x"], chart["data"]["y"] = zip(*xy[:lr_chart_max_size])
                down_sampled = True

    if down_sampled:
        data["validations"].append({
            "name": "SampledOutput",
            "level": "WARNING",
            "message": "As the data is too large to be rendered, some scatter plots display only randomly sampled data",
        })

    data["table"] = pd_table.head(table_head).to_dict()

    return data
