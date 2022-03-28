from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def clustering_task(self,
                    datasource_id,
                    color,
                    columns,
                    number_clusters,
                    filters,
                    user_id,
                    extra_columns=None,
                    explain_samples=False,
                    max_train_samples=None,
                    table_head=1000):
    """
    TODO write documentation
    """
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters
    from actableai.tasks.clustering import AAIClusteringTask
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset.billing.utils import add_billing_balance_history

    if extra_columns is None:
        extra_columns = []

    self.update_state(state="PROCESSING")
    # Input data
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    tb_name = datasource.table_name
    schema = datasource.schema
    all_columns = extra_columns + columns
    if color != "cluster_id" and color not in all_columns:
        all_columns.append(color)
    df_all = data_filters(tb_name, db, schema, filters=filters, columns=all_columns, datasource_id=datasource_id)

    connect_to_ray()

    ray_params = {
        "num_cpus": float(app.config['N_CPU_SEGMENTATION']),
        "num_gpus": float(app.config['N_GPU_SEGMENTATION'])
    }

    task_params = {
        "use_ray": True,
        "ray_params": ray_params,
        "optimize_memory_allocation": True,
        "collect_memory_usage": True,
        "optimize_gpu_memory_allocation": False,
        "collect_gpu_memory_usage": True,
        "resources_predictors_actor": get_resources_predictors_actor(),
        "max_memory_offset": float(app.config["MEMORY_OPTIMIZER_OFFSET"]),
        "optimize_memory_allocation_nrmse_threshold": float(app.config["MEMORY_OPTIMIZER_NRMSE_THRESHOLD"])
    }

    task = AAIClusteringTask(**task_params)
    data = task.run(
        df_all,
        features=columns,
        num_clusters=number_clusters,
        explain_samples=explain_samples,
        explain_max_concurrent=5,
        max_train_samples=max_train_samples,
    )

    data["table"] = df_all.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "plotly_tsne", data["runtime"], datasource)
    return data
