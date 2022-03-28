from typing import List
from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError

from superset.extensions import celery_app
from superset.filters import data_filters

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def data_imputation_task(self,
                         datasource_id,
                         rules,
                         filters,
                         user_id,
                         impute_nulls=True,
                         table_head=1000):
    """
    TODO write documentation
    """
    from superset.utils import connect_to_ray
    from superset.utils.prediction import get_resources_predictors_actor
    from superset import db, app
    from superset.connectors.sqla.models import SqlaTable
    from actableai.tasks.data_imputation import AAIDataImputationTask, construct_rules
    from superset.billing.utils import add_billing_balance_history

    self.update_state(state="PROCESSING")
    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    schema = datasource.schema
    df_all = data_filters(datasource.table_name, db, schema, filters, datasource_id=datasource_id)
    columns_all = df_all.columns.tolist()
    if "_tid_" in columns_all:
        columns_all.remove("_tid_")
    df = df_all[columns_all]

    connect_to_ray()

    task = AAIDataImputationTask(
        use_ray=True,
        ray_params={
            "num_cpus": float(app.config["N_CPU_IMPUTATION"]),
            "num_gpus": float(app.config["N_GPU_IMPUTATION"]),
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
        construct_rules(rules),
        impute_nulls
    )

    data["table"] = df.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "clean_data", data["runtime"], datasource)
    return data
