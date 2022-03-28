from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def bayesian_regression_task(self,
                    datasource_id,
                    target,
                    predictors,
                    filters,
                    user_id,
                    polynomial_degree=1,
                    validation_split=None,
                    prediction_quantile_low=5,
                    prediction_quantile_high=95,
                    trials=1,
                    priors=None,
                    table_head=1000,
                    ):
    """
    TODO write documentation
    """
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset.billing.utils import add_billing_balance_history

    from actableai.tasks.bayesian_regression import AAIBayesianRegressionTask

    self.update_state(state="PROCESSING")

    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    schema = datasource.schema
    pd_table = data_filters(nameTb, db, schema, filters, columns=predictors + [target], datasource_id=datasource_id)

    connect_to_ray()

    ray_params = {
        "num_cpus": float(app.config['N_CPU_BAYESIAN_REGRESSION']),
        "num_gpus": float(app.config['N_GPU_BAYESIAN_REGRESSION'])
    }

    task = AAIBayesianRegressionTask(
        use_ray=True,
        ray_params=ray_params,
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
        predictors,
        target,
        polynomial_degree=polynomial_degree,
        validation_split=validation_split,
        prediction_quantile_low=prediction_quantile_low,
        prediction_quantile_high=prediction_quantile_high,
        trials=trials,
        priors=priors,
    )

    data["table"] = pd_table.head(table_head)
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "regression_prediction", data["runtime"], datasource)
    return data

