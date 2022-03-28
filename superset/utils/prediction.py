def get_resources_predictors_actor():
    from superset import app
    from actableai.utils.resources.predict.predictor import ResourcesPredictorsActor

    return ResourcesPredictorsActor.get_actor(
        s3_resources_predictors_bucket=app.config["AWS_S3_RESOURCES_PREDICTORS_BUCKET"],
        s3_resources_predictors_prefix=app.config["AWS_S3_RESOURCES_PREDICTORS_PREFIX"],
        backup_state_probability=float(app.config["RESOURCES_PREDICTORS_BACKUP_PROBABILITY"])
    )
