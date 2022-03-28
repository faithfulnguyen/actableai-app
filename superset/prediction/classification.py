from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def classification_task(self,
                        datasource_id,
                        target,
                        columns,
                        filters,
                        user_id,
                        biased_groups=None,
                        debiased_features=None,
                        validation_ratio=None,
                        explain_samples=False,
                        extra_columns=None,
                        presets="medium_quality_faster_train",
                        kfolds=1,
                        cross_validation_max_concurrency=2,
                        table_head=1000):
    """
    TODO write documentation
    """
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters
    from actableai.tasks.classification import AAIClassificationTask
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset.billing.utils import add_billing_balance_history

    if extra_columns is None:
        extra_columns = []
    if biased_groups is None:
        biased_groups = []
    if debiased_features is None:
        debiased_features = []

    self.update_state(state="PROCESSING")
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    schema = datasource.schema
    all_columns = biased_groups + extra_columns + columns + [target]
    pd_table = data_filters(nameTb, db, schema, filters, columns=all_columns, datasource_id=datasource_id)

    connect_to_ray()

    ray_params = {
        "num_cpus": float(app.config['N_CPU_CLASSIFICATION']),
        "num_gpus": float(app.config['N_GPU_CLASSIFICATION'])
    }

    task_params = {
        "ray_params": ray_params,
        "optimize_memory_allocation": True,
        "collect_memory_usage": True,
        "optimize_gpu_memory_allocation": False,
        "collect_gpu_memory_usage": True,
        "resources_predictors_actor": get_resources_predictors_actor(),
        "max_memory_offset": float(app.config["MEMORY_OPTIMIZER_OFFSET"]),
        "optimize_memory_allocation_nrmse_threshold": float(app.config["MEMORY_OPTIMIZER_NRMSE_THRESHOLD"])
    }

    train_task_use_ray = kfolds > 1 and cross_validation_max_concurrency > 1

    task = AAIClassificationTask(use_ray=True, **task_params)
    data = task.run(
        pd_table,
        target,
        columns,
        biased_groups=biased_groups,
        debiased_features=debiased_features,
        validation_ratio=validation_ratio,
        explain_samples=explain_samples,
        presets=presets,
        kfolds=kfolds,
        cross_validation_max_concurrency=cross_validation_max_concurrency,
        train_task_params={"use_ray": train_task_use_ray, **task_params},
        num_gpus=0,
    )

    data["table"] = pd_table.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "classification_prediction", data["runtime"], datasource)
    return data
