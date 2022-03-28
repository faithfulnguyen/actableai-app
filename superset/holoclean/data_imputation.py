from superset.extensions import celery_app
from superset.filters import data_filters
import re

@celery_app.task(bind=True)
def data_imputation(self, datasource_id, rules, filters, user_id, impute_nulls=True):
    import ray
    from superset.utils import connect_to_ray
    from superset import db, app
    from superset.connectors.sqla.models import SqlaTable
    from sqlalchemy.schema import DropSchema
    from actableai.tasks.data_imputation import data_imputation_remote
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
    tb_norm_name = re.sub('[^A-Za-z0-9\_]+', '', datasource.table_name)[:30]
    name = "temp_" + tb_norm_name

    connect_to_ray()
    result = ray.remote(data_imputation_remote)\
            .options(num_cpus=float(app.config["N_CPU_IMPUTATION"]),
                    num_gpus=float(app.config["N_GPU_IMPUTATION"]))\
            .remote(name, df, rules, app.config["SQLALCHEMY_DATABASE_URI"], impute_nulls)
    data = ray.get(result)
    data["table"] = df.to_dict()
    if data["status"] == "SUCCESS":
        add_billing_balance_history(user_id, "clean_data", data["runtime"], datasource)
    return data
