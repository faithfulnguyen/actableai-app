#!/usr/bin/env bash

set -eo pipefail

if [[ "${1}" == "worker" ]]; then
  echo "Starting Celery worker..."
    celery --app=superset.tasks.celery_app:app worker --pool prefork --concurrency 32 --task-events
elif [[ "${1}" == "beat" ]]; then
  echo "Starting Celery beat..."
  celery beat --app=superset.tasks.celery_app:app --pidfile /tmp/celerybeat.pid -l INFO
elif [[ "${1}" == "app" ]]; then
  echo "Starting web app..."
  flask run -p 8088 --with-threads --reload --debugger --host=0.0.0.0
elif [[ "${1}" == "app-gunicorn" ]]; then
  echo "Starting web app..."
  /app/docker/docker-entrypoint.sh
elif [[ "${1}" == "flower" ]]; then
  echo "Starting flower monitoring..."
  celery --app=superset.tasks.celery_app:app flower
fi
