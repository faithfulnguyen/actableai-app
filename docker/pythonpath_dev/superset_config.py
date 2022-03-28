# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

#
# This file is included in the final Docker image and SHOULD be overridden when
# deploying the image to prod. Settings configured here are intended for use in local
# development environments. Also note that superset_config_docker.py is imported
# as a final step as a means to override "defaults" configured here
#

import logging
import os

from superset.security.manager import OverfitSecurityManager
from werkzeug.contrib.cache import FileSystemCache
from kombu.serialization import register
from superset.utils import CustomJSONEncoder, aai_dumps, aai_loads


logger = logging.getLogger()


def get_env_variable(var_name, default=None):
    """Get the environment variable or raise exception."""
    try:
        return os.environ[var_name]
    except KeyError:
        if default is not None:
            return default
        else:
            error_msg = "The environment variable {} was missing, abort...".format(
                var_name
            )
            raise EnvironmentError(error_msg)


DATABASE_DIALECT = get_env_variable("DATABASE_DIALECT")
DATABASE_USER = get_env_variable("DATABASE_USER")
DATABASE_PASSWORD = get_env_variable("DATABASE_PASSWORD")
DATABASE_HOST = get_env_variable("DATABASE_HOST")
DATABASE_PORT = get_env_variable("DATABASE_PORT")
DATABASE_DB = get_env_variable("DATABASE_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = "%s://%s:%s@%s:%s/%s" % (
    DATABASE_DIALECT,
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_DB,
)

REDIS_HOST = get_env_variable("REDIS_HOST")
REDIS_PORT = get_env_variable("REDIS_PORT")

RAY_CLIENT = get_env_variable("RAY_CLIENT")
RAY_ADDRESS = get_env_variable("RAY_ADDRESS")
RAY_PASSWORD = get_env_variable("RAY_PASSWORD")
RAY_MAX_CONCURRENT = get_env_variable("RAY_MAX_CONCURRENT")
RAY_CPU_PER_TRIAL = get_env_variable("RAY_CPU_PER_TRIAL")
RAY_GPU_PER_TRIAL = get_env_variable("RAY_GPU_PER_TRIAL")

N_CPU_CLASSIFICATION=get_env_variable("N_CPU_CLASSIFICATION")
N_GPU_CLASSIFICATION=get_env_variable("N_GPU_CLASSIFICATION")

N_CPU_REGRESSION=get_env_variable("N_CPU_REGRESSION")
N_GPU_REGRESSION=get_env_variable("N_GPU_REGRESSION")

N_CPU_TIMESERIES=get_env_variable("N_CPU_TIMESERIES")
N_GPU_TIMESERIES=get_env_variable("N_GPU_TIMESERIES")

N_CPU_SEGMENTATION=get_env_variable("N_CPU_SEGMENTATION")
N_GPU_SEGMENTATION=get_env_variable("N_GPU_SEGMENTATION")

N_CPU_IMPUTATION=get_env_variable("N_CPU_IMPUTATION")
N_GPU_IMPUTATION=get_env_variable("N_GPU_IMPUTATION")

N_CPU_CORRELATION=get_env_variable("N_CPU_CORRELATION")
N_GPU_CORRELATION=get_env_variable("N_GPU_CORRELATION")

N_CPU_BAYESIAN_REGRESSION=get_env_variable("N_CPU_BAYESIAN_REGRESSION")
N_GPU_BAYESIAN_REGRESSION=get_env_variable("N_GPU_BAYESIAN_REGRESSION")

RESULTS_BACKEND = FileSystemCache('/app/superset_home/sqllab')

SUPERSET_DOMAIN = get_env_variable('SUPERSET_DOMAIN')
MAILGUN_SERVER_NAME = get_env_variable('MAILGUN_SERVER_NAME')
MAILGUN_PORT = get_env_variable('MAILGUN_PORT')
MAILGUN_ACCOUNT = get_env_variable('MAILGUN_ACCOUNT')
MAILGUN_PASSWORD = get_env_variable('MAILGUN_PASSWORD')
MAILGUN_FROM = get_env_variable('MAILGUN_FROM')
GOOGLE_APPLICATION_CREDENTIALS = get_env_variable('GOOGLE_APPLICATION_CREDENTIALS')
IP_WISHLIST = ['*']
GOOGLE_ID = get_env_variable('GOOGLE_ID')
GOOGLE_SECRET = get_env_variable('GOOGLE_SECRET')
STRIPE_PUBLISHABLE_KEY = get_env_variable('STRIPE_PUBLISHABLE_KEY')
STRIPE_SECRET_KEY = get_env_variable('STRIPE_SECRET_KEY')
LANDING_HOST = get_env_variable('LANDING_HOST')
DOCS_LINK = get_env_variable('DOCS_LINK')
CHAT_BOX_ENABLE = "true"

register("aai_json", aai_dumps, aai_loads,
    content_type='application/json',
    content_encoding='utf-8')

class CeleryConfig(object):
    broker_url = "redis://%s:%s/0" % (REDIS_HOST, REDIS_PORT)
    imports = ("superset.sql_lab",)
    result_backend = "redis://%s:%s/1" % (REDIS_HOST, REDIS_PORT)
    task_annotations = {"tasks.add": {"rate_limit": "10/s"}}
    worker_redirect_stdouts = False
    task_protocol = 1
    accept_content = ["aai_json"]
    task_serializer = "aai_json"
    result_serializer = "aai_json"


CELERY_CONFIG = CeleryConfig

CUSTOM_SECURITY_MANAGER = OverfitSecurityManager
WTF_CSRF_ENABLED = True
FAB_ALLOW_GET_UNSAFE_MUTATIONS = True
WTF_CSRF_EXEMPT_LIST = [
    'superset.views.core.sql_json',
    'superset.views.core.explore_json',
    'superset.datasets.api.post',
    'superset.datasets.api.delete',
    'superset.datasets.api.bulk_delete',
    'superset.datasets.api.upload_csv',
    'superset.billing.views.webhook_received',
    'superset.datasets.api.clone',
    'superset.datasets.api.download',
    'superset.charts.api.clone_chart',
    'superset.charts.api.download',
    'superset.charts.api.check_result',
    'superset.charts.api.list_datasource',
    'superset.dashboards.api.clone',
    'superset.connectors.sqla.views.edit',
    'flask_monitoringdashboard.views.auth.login',
    'flask_monitoringdashboard.views.version.multi_version',
    'flask_monitoringdashboard.views.endpoint.api_performance',
    'flask_monitoringdashboard.views.auth.user_create',
    'flask_monitoringdashboard.views.auth.user_edit',
    'flask_monitoringdashboard.views.endpoint.set_rule',
    'flask_monitoringdashboard.views.endpoint.endpoint_users',
    'flask_monitoringdashboard.views.version.version_user',
    'flask_monitoringdashboard.views.version.version_ip',
    'flask_monitoringdashboard.views.endpoint.endpoint_versions',
    'superset.dashboards.api.bulk_delete',
    'superset.views.core.log',
    'superset.charts.api.bulk_delete'
]
#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    from superset_config_docker import *  # noqa
    import superset_config_docker

    logger.info(
        f"Loaded your Docker configuration at " f"[{superset_config_docker.__file__}]"
    )
except ImportError:
    logger.info("Using default Docker config...")
