from ray.exceptions import RayActorError
from ray.exceptions import WorkerCrashedError
from celery.exceptions import WorkerLostError
from typing import Optional

from superset.extensions import celery_app

@celery_app.task(bind=True,
                 autoretry_for=(RayActorError, WorkerLostError, WorkerCrashedError),
                 retry_kwargs={'max_retries': 5, 'countdown': 60})
def causal_inference_task(self,
        datasource_id,
        outcomes,
        positive_outcome_value,
        treatments,
        filters,
        user_id,
        effect_modifiers: list=[],
        common_causes: list=[],
        controls=None,
        log_treatment=False,
        log_outcome=False,
        feature_importance=True,
        table_head=1000):
    import os
    import ray
    from superset import app
    from superset.connectors.sqla.models import SqlaTable
    from superset import db
    from superset.filters import data_filters

    from actableai.tasks.causal_inference import infer_causal
    from superset.utils import connect_to_ray
    from superset.billing.utils import add_billing_balance_history

    self.update_state(state="PROCESSING")

    datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
    db = datasource.database
    nameTb = datasource.table_name
    schema = datasource.schema
    columns = list(set(outcomes + treatments + effect_modifiers + common_causes))
    pd_table = data_filters(nameTb, db, schema, filters, columns=columns, datasource_id=datasource_id)

    # Temp fix: somehow XGBoost GPU uses a lot of memory (on CPU) when there is no common causes
    # and effect modifier.
    num_gpus  = 1 if len(effect_modifiers + common_causes) > 0 else 0
    connect_to_ray()
    result = ray.remote(infer_causal)\
        .options(
            num_cpus=float(app.config["N_CPU_CAUSAL_INFERENCE"]),
            num_gpus=float(app.config["N_GPU_CAUSAL_INFERENCE"]))\
        .remote(
            pd_table,
            treatments=treatments,
            controls=controls,
            outcomes=outcomes,
            positive_outcome_value=positive_outcome_value,
            effect_modifiers=effect_modifiers,
            common_causes=common_causes,
            log_treatment=log_treatment,
            log_outcome=log_outcome,
            feature_importance=feature_importance,
            ag_presets="medium_quality_faster_train",
            num_gpus=0,
        )

    data = ray.get(result)
    data["table"] = pd_table.head(table_head).to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(
            user_id, "causal_inference", data["runtime"], datasource)
    return data

