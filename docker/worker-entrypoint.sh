#!/bin/bash

ray start --address=ray:6377
celery --app=superset.tasks.celery_app:app worker -P prefork --max-memory-per-child=4000000