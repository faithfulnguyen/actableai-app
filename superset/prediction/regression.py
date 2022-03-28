from typing import List
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app
from celery.utils.log import get_task_logger
import logging

logger = get_task_logger(__name__)
logger.setLevel(logging.DEBUG)

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def regression_task(self,
                    datasource_id,
                    target,
                    features,
                    filters,
                    user_id,
                    biased_groups=None,
                    debiased_features=None,
                    extra_columns=None,
                    validation_ratio=None,
                    prediction_quantile_low=5,
                    prediction_quantile_high=95,
                    presets=None,
                    explain_samples=False,
                    cross_validation=False,
                    kfolds=1,
                    cross_validation_max_concurrency=2,
                    current_intervention_column=None,
                    new_intervention_column=None,
                    cate_alpha=0.05,
                    common_causes: List[str]=[],
                    causal_cv=2,
                    causal_hyperparameters=None,
                    table_head=1000,
                    ):
    """
    TODO write documentation
    """
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters
    from actableai.tasks.regression import AAIRegressionTask
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
    df = data_filters(
        nameTb,
        db,
        schema,
        filters,
        columns=extra_columns \
            + features \
            + biased_groups \
            + ([new_intervention_column] if new_intervention_column is not None else []) \
            + [target],
        datasource_id=datasource_id
    )

    connect_to_ray()

    ray_params = {
        "num_cpus": float(app.config['N_CPU_REGRESSION']),
        "num_gpus": float(app.config['N_GPU_REGRESSION'])
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

    task = AAIRegressionTask(use_ray=True, **task_params)
    data = task.run(
        df,
        target,
        features,
        biased_groups=biased_groups,
        debiased_features=debiased_features,
        validation_ratio=validation_ratio,
        prediction_quantile_low=prediction_quantile_low,
        prediction_quantile_high=prediction_quantile_high,
        presets=presets,
        explain_samples=explain_samples,
        kfolds=kfolds,
        cross_validation_max_concurrency=cross_validation_max_concurrency,
        train_task_params={"use_ray": train_task_use_ray, **task_params},
        current_intervention_column=current_intervention_column,
        new_intervention_column=new_intervention_column,
        common_causes=common_causes,
        causal_cv=causal_cv,
        causal_hyperparameters=None,
        cate_alpha=cate_alpha,
        num_gpus=0,
    )

    data["table"] = df.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "regression_prediction", data["runtime"], datasource)
    return data
