from superset.extensions import celery_app
from superset import app
import requests
import json


@celery_app.task(bind=True)
def correlation_job(self, job_id):
    self.update_state(state="PROCESSING")
    supersetDomain = app.config.get("SUPERSET_DOMAIN")
    resp = requests.get(supersetDomain + "/spark-jobserver/jobs/" + job_id)
    data = resp.json()
    payload = {
        "supersetUrl": supersetDomain,
        "data": data
    }
    if app.config.get('FULFILLMENT_ENABLE') == 'true':
        headers = {"Content-Type": "application/json"}
        req_url = app.config.get("FULFILLMENT_HOST") + "/receive-job"
        requests.post(req_url, data=json.dumps(payload), headers=headers)
    return data
