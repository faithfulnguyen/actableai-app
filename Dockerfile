# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

######################################################################
# PY stage that simply does a pip install on our requirements
######################################################################
ARG PY_VER=3.7.7
FROM python:${PY_VER} AS superset-py

RUN mkdir /app \
        && apt-get update -y \
        && apt-get install -y unixodbc-dev \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

# First, we just wanna install requirements, which will allow us to utilize the cache
# in order to only build if and only if requirements change
COPY ./requirements.txt /app/

RUN cd /app \
        && pip install --upgrade setuptools pip \
        && pip install --use-deprecated=legacy-resolver -r requirements.txt


######################################################################
# Node stage to deal with static asset construction
######################################################################
FROM node:10-jessie AS superset-node

ARG NPM_BUILD_CMD="build"
ARG NPM_ACTION="ci"
ENV BUILD_CMD=${NPM_BUILD_CMD}

# NPM ci first, as to NOT invalidate previous steps except for when package.json changes
RUN mkdir -p /app/superset-frontend
RUN mkdir -p /app/superset/assets
COPY ./docker/frontend-mem-nag.sh /
COPY ./superset-frontend/package* /app/superset-frontend/
RUN /frontend-mem-nag.sh \
        && cd /app/superset-frontend \
        && npm ${NPM_ACTION}

# Next, copy in the rest and let webpack do its thing
COPY ./superset-frontend /app/superset-frontend
# This is BY FAR the most expensive step (thanks Terser!)
RUN cd /app/superset-frontend \
        && npm run ${BUILD_CMD} \
        && rm -rf node_modules


######################################################################
# Final lean image...
######################################################################
ARG PY_VER=3.7.4
FROM python:${PY_VER} AS lean

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    FLASK_ENV=production \
    FLASK_MONITORING_DASHBOARD_CONFIG="/app/fmd.cfg" \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8088

RUN useradd --user-group --no-create-home --no-log-init --shell /bin/bash superset \
        && mkdir -p ${SUPERSET_HOME} ${PYTHONPATH} \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
        && apt-get install -y cron curl\
        && rm -rf /var/lib/apt/lists/*

COPY --from=superset-py /usr/local/lib/python3.7/site-packages/ /usr/local/lib/python3.7/site-packages/
# Copying site-packages doesn't move the CLIs, so let's copy them one by one
COPY --from=superset-py /usr/local/bin/gunicorn /usr/local/bin/celery /usr/local/bin/flask /usr/bin/
COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets
COPY --from=superset-node /app/superset-frontend /app/superset-frontend

RUN git clone https://github.com/JohnOmernik/sqlalchemy-drill \
        && cd sqlalchemy-drill \
        && python3 setup.py install \
        && rm -rf sqlalchemy-drill

WORKDIR /

## Lastly, let's install superset itself
COPY superset /app/superset
COPY setup.py MANIFEST.in README.md /app/
RUN cd /app \
        && chown -R superset:superset * \
        && pip install -e .

COPY ./docker/docker-entrypoint.sh /usr/bin/
COPY ./docker/docker-bootstrap.sh /usr/bin/
COPY ./docker/docker-init.sh /usr/bin/

WORKDIR /app

RUN mkdir -p /app/dask-worker-space
RUN chmod 777 -R /app/dask-worker-space && chown -R superset:superset .

COPY ./actableai-lib ./actableai-lib
ENV PYTHONPATH=/app:/app/actableai-lib:/etc/superset:$PYTHONPATH


#####################################################################
## Installing Flask Monitoring Dashboard (FMD)
#####################################################################

RUN pip install flask_monitoringdashboard

RUN mkdir /app/dashboarddb && chown -R superset:superset /app/dashboarddb

COPY --chown=superset:superset ./docker/fmd.cfg /app/fmd.cfg

USER superset

HEALTHCHECK CMD ["curl", "-f", "http://localhost:8088/health"]

EXPOSE ${SUPERSET_PORT}

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]

######################################################################
# Dev image...
######################################################################
FROM lean AS dev

USER root

COPY ./requirements-dev.txt ./docker/requirements* /app/
RUN pip install -r /app/requirements-dev.txt


USER superset
