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
# pylint: disable=C,R,W
"""This module contains the 'Viz' objects

These objects represent the backend of all the visualizations that
Superset can render.
"""
import copy
import hashlib
import inspect

import logging
import math
import pickle as pkl
import re
import uuid
from collections import defaultdict, OrderedDict
from datetime import datetime, timedelta
from itertools import product
from typing import Any, Dict, List, Optional, Set, Tuple, TYPE_CHECKING
from io import BytesIO

from dateutil import relativedelta as rdelta
from flask import request, g, abort
from flask_babel import lazy_gettext as _
import geohash
from geopy.point import Point
from markdown import markdown
import numpy as np
import pandas as pd
from pandas.tseries.frequencies import to_offset
import polyline
import simplejson as json

from superset import app, cache, get_manifest_files, security_manager
from superset.constants import NULL_STRING
from superset.exceptions import NullValueException, SpatialException
from superset.models.helpers import QueryResult
from superset.prediction.stats_models import anova_task
from superset.typing import VizData
from superset.utils import aai_dumps, aai_loads, core as utils
from superset.utils.core import (
    DTTM_ALIAS,
    JS_MAX_INTEGER,
    merge_extra_filters,
    to_adhoc,
)
from superset.prediction.causal_inference import causal_inference_task
from superset.prediction.forecast import forecast_task
from superset.prediction.regression import regression_task
from superset.prediction.correlation import correlation_task
from superset.prediction.sentiment_analysis import sentiment_task
from superset.prediction.classification import classification_task
from superset.prediction.clustering import clustering_task
from superset.prediction.data_imputation import data_imputation_task
from superset.prediction.bayesian_regression import bayesian_regression_task
import requests
import time
import superset.models.core as models

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource

config = app.config
stats_logger = config.get("STATS_LOGGER")
relative_start = config.get("DEFAULT_RELATIVE_START_TIME", "today")
relative_end = config.get("DEFAULT_RELATIVE_END_TIME", "today")
logger = logging.getLogger(__name__)

METRIC_KEYS = [
    "metric",
    "metrics",
    "percent_metrics",
    "metric_2",
    "secondary_metric",
    "x",
    "y",
    "size",
]

task_types = {
    "plotly_prediction": forecast_task,
    "classification_prediction": classification_task,
    "regression_prediction": regression_task,
    "plotly_tsne": clustering_task,
    "clean_data": data_imputation_task,
    "plotly_correlation": correlation_task,
    "sentiment_analysis": sentiment_task,
    "causal_inference": causal_inference_task,
    "bayesian_regression": bayesian_regression_task,
}


class BaseViz:

    """All visualizations derive this base class"""

    viz_type = None
    verbose_name = "Base Viz"
    credits = ""
    is_timeseries = False
    cache_type = "df"
    enforce_numerical_metrics = True

    def __init__(
        self,
        datasource: "BaseDatasource",
        form_data: Dict[str, Any],
        force: bool = False,
    ):
        if not datasource:
            raise Exception(_("Viz is missing a datasource"))

        self.datasource = datasource
        self.request = request
        self.viz_type = form_data.get("viz_type")
        self.form_data = form_data

        self.query = ""
        self.token = self.form_data.get("token", "token_" + uuid.uuid4().hex[:8])

        self.groupby = self.form_data.get("groupby") or []
        self.time_shift = timedelta()

        self.status: Optional[str] = None
        self.error_msg = ""
        self.results: Optional[QueryResult] = None
        self.error_message: Optional[str] = None
        self.force = force

        # Keeping track of whether some data came from cache
        # this is useful to trigger the <CachedLabel /> when
        # in the cases where visualization have many queries
        # (FilterBox for instance)
        self._any_cache_key: Optional[str] = None
        self._any_cached_dttm: Optional[str] = None
        self._extra_chart_data: List[Tuple[str, pd.DataFrame]] = []

        self.process_metrics()

    def process_metrics(self):
        # metrics in TableViz is order sensitive, so metric_dict should be
        # OrderedDict
        self.metric_dict = OrderedDict()
        fd = self.form_data
        for mkey in METRIC_KEYS:
            val = fd.get(mkey)
            if val:
                if not isinstance(val, list):
                    val = [val]
                for o in val:
                    label = utils.get_metric_name(o)
                    self.metric_dict[label] = o

        # Cast to list needed to return serializable object in py3
        self.all_metrics = list(self.metric_dict.values())
        self.metric_labels = list(self.metric_dict.keys())

    @staticmethod
    def handle_js_int_overflow(data):
        for d in data.get("records", dict()):
            for k, v in list(d.items()):
                if isinstance(v, int):
                    # if an int is too big for Java Script to handle
                    # convert it to a string
                    if abs(v) > JS_MAX_INTEGER:
                        d[k] = str(v)
        return data

    def run_extra_queries(self):
        """Lifecycle method to use when more than one query is needed

        In rare-ish cases, a visualization may need to execute multiple
        queries. That is the case for FilterBox or for time comparison
        in Line chart for instance.

        In those cases, we need to make sure these queries run before the
        main `get_payload` method gets called, so that the overall caching
        metadata can be right. The way it works here is that if any of
        the previous `get_df_payload` calls hit the cache, the main
        payload's metadata will reflect that.

        The multi-query support may need more work to become a first class
        use case in the framework, and for the UI to reflect the subtleties
        (show that only some of the queries were served from cache for
        instance). In the meantime, since multi-query is rare, we treat
        it with a bit of a hack. Note that the hack became necessary
        when moving from caching the visualization's data itself, to caching
        the underlying query(ies).
        """
        pass

    def apply_rolling(self, df):
        fd = self.form_data
        rolling_type = fd.get("rolling_type")
        rolling_periods = int(fd.get("rolling_periods") or 0)
        min_periods = int(fd.get("min_periods") or 0)

        if rolling_type in ("mean", "std", "sum") and rolling_periods:
            kwargs = dict(window=rolling_periods, min_periods=min_periods)
            if rolling_type == "mean":
                df = df.rolling(**kwargs).mean()
            elif rolling_type == "std":
                df = df.rolling(**kwargs).std()
            elif rolling_type == "sum":
                df = df.rolling(**kwargs).sum()
        elif rolling_type == "cumsum":
            df = df.cumsum()
        if min_periods:
            df = df[min_periods:]
        return df

    def get_samples(self):
        query_obj = self.query_obj()
        query_obj.update(
            {
                "groupby": [],
                "metrics": [],
                "row_limit": 1000,
                "columns": [o.column_name for o in self.datasource.columns],
            }
        )
        df = self.get_df(query_obj)
        return df.to_dict(orient="records")

    def get_df(self, query_obj: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        """Returns a pandas dataframe based on the query object"""

        if not query_obj:
            query_obj = self.query_obj()
        if not query_obj:
            return pd.DataFrame()

        self.error_msg = ""

        timestamp_format = None
        if self.datasource.type == "table":
            granularity_col = self.datasource.get_column(query_obj["granularity"])
            if granularity_col:
                timestamp_format = granularity_col.python_date_format

        # The datasource here can be different backend but the interface is common
        self.results = self.datasource.query(query_obj)
        self.query = self.results.query
        self.status = self.results.status
        self.error_message = self.results.error_message

        df = self.results.df
        # Transform the timestamp we received from database to pandas supported
        # datetime format. If no python_date_format is specified, the pattern will
        # be considered as the default ISO date format
        # If the datetime format is unix, the parse will use the corresponding
        # parsing logic.
        if not df.empty:
            if DTTM_ALIAS in df.columns:
                if timestamp_format in ("epoch_s", "epoch_ms"):
                    # Column has already been formatted as a timestamp.
                    dttm_col = df[DTTM_ALIAS]
                    one_ts_val = dttm_col[0]

                    # convert time column to pandas Timestamp, but different
                    # ways to convert depending on string or int types
                    try:
                        int(one_ts_val)
                        is_integral = True
                    except (ValueError, TypeError):
                        is_integral = False
                    if is_integral:
                        unit = "s" if timestamp_format == "epoch_s" else "ms"
                        df[DTTM_ALIAS] = pd.to_datetime(
                            dttm_col, utc=False, unit=unit, origin="unix"
                        )
                    else:
                        df[DTTM_ALIAS] = dttm_col.apply(pd.Timestamp)
                else:
                    df[DTTM_ALIAS] = pd.to_datetime(
                        df[DTTM_ALIAS], utc=False, format=timestamp_format
                    )
                if self.datasource.offset:
                    df[DTTM_ALIAS] += timedelta(hours=self.datasource.offset)
                df[DTTM_ALIAS] += self.time_shift

            if self.enforce_numerical_metrics:
                self.df_metrics_to_num(df)

            df.replace([np.inf, -np.inf], np.nan, inplace=True)
        return df

    def df_metrics_to_num(self, df):
        """Converting metrics to numeric when pandas.read_sql cannot"""
        metrics = self.metric_labels
        for col, dtype in df.dtypes.items():
            if dtype.type == np.object_ and col in metrics:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    def process_query_filters(self):
        utils.convert_legacy_filters_into_adhoc(self.form_data)
        merge_extra_filters(self.form_data)
        utils.split_adhoc_filters_into_base_filters(self.form_data)

    def query_obj(self) -> Dict[str, Any]:
        """Building a query object"""
        form_data = self.form_data
        # logging.info("form data: %s" % form_data)
        self.process_query_filters()
        gb = form_data.get("groupby") or []
        metrics = self.all_metrics or []
        columns = form_data.get("columns") or []
        groupby = list(set(gb + columns))

        is_timeseries = self.is_timeseries
        if DTTM_ALIAS in groupby:
            groupby.remove(DTTM_ALIAS)
            is_timeseries = True

        granularity = form_data.get("granularity") or form_data.get("granularity_sqla")
        limit = int(form_data.get("limit") or 0)
        timeseries_limit_metric = form_data.get("timeseries_limit_metric")
        row_limit = int(form_data.get("row_limit") or config.get("ROW_LIMIT"))

        # default order direction
        order_desc = form_data.get("order_desc", True)

        since, until = utils.get_since_until(
            relative_start=relative_start,
            relative_end=relative_end,
            time_range=form_data.get("time_range"),
            since=form_data.get("since"),
            until=form_data.get("until"),
        )
        time_shift = form_data.get("time_shift", "")
        self.time_shift = utils.parse_past_timedelta(time_shift)
        from_dttm = None if since is None else (since - self.time_shift)
        to_dttm = None if until is None else (until - self.time_shift)
        if from_dttm and to_dttm and from_dttm > to_dttm:
            raise Exception(_("From date cannot be larger than to date"))

        self.from_dttm = from_dttm
        self.to_dttm = to_dttm

        # extras are used to query elements specific to a datasource type
        # for instance the extra where clause that applies only to Tables
        extras = {
            "where": form_data.get("where", ""),
            "having": form_data.get("having", ""),
            "having_druid": form_data.get("having_filters", []),
            "time_grain_sqla": form_data.get("time_grain_sqla", ""),
            "time_range_endpoints": form_data.get("time_range_endpoints", ""),
            "where": form_data.get("where", ""),
        }

        d = {
            "granularity": granularity,
            "from_dttm": from_dttm,
            "to_dttm": to_dttm,
            "is_timeseries": is_timeseries,
            "groupby": groupby,
            "metrics": metrics,
            "row_limit": row_limit,
            "filter": self.form_data.get("filters", []),
            "timeseries_limit": limit,
            "extras": extras,
            "timeseries_limit_metric": timeseries_limit_metric,
            "order_desc": order_desc,
        }
        return d

    @property
    def cache_timeout(self):
        if self.form_data.get("cache_timeout") is not None:
            return int(self.form_data.get("cache_timeout"))
        if self.datasource.cache_timeout is not None:
            return self.datasource.cache_timeout
        if (
            hasattr(self.datasource, "database")
            and self.datasource.database.cache_timeout
        ) is not None:
            return self.datasource.database.cache_timeout
        return config.get("CACHE_DEFAULT_TIMEOUT")

    def get_json(self):
        return json.dumps(
            self.get_payload(), default=utils.json_int_dttm_ser, ignore_nan=True
        )

    def cache_key(self, query_obj, **extra):
        """
        The cache key is made out of the key/values in `query_obj`, plus any
        other key/values in `extra`.

        We remove datetime bounds that are hard values, and replace them with
        the use-provided inputs to bounds, which may be time-relative (as in
        "5 days ago" or "now").

        The `extra` arguments are currently used by time shift queries, since
        different time shifts wil differ only in the `from_dttm` and `to_dttm`
        values which are stripped.
        """
        cache_dict = copy.copy(query_obj)
        cache_dict.update(extra)

        for k in ["from_dttm", "to_dttm"]:
            del cache_dict[k]

        cache_dict["time_range"] = self.form_data.get("time_range")
        cache_dict["datasource"] = self.datasource.uid
        cache_dict["extra_cache_keys"] = self.datasource.get_extra_cache_keys(query_obj)
        cache_dict["rls"] = security_manager.get_rls_ids(self.datasource)
        cache_dict["changed_on"] = self.datasource.changed_on
        json_data = self.json_dumps(cache_dict, sort_keys=True)
        return hashlib.md5(json_data.encode("utf-8")).hexdigest()

    def get_payload(self, query_obj=None):
        """Returns a payload of metadata and data"""
        self.run_extra_queries()
        payload = self.get_df_payload(query_obj)

        df = payload.get("df")
        if self.status != utils.QueryStatus.FAILED:
            payload["data"] = self.get_data(df)
        if "df" in payload:
            del payload["df"]
        return payload

    def get_df_payload(self, query_obj=None, **kwargs):
        """Handles caching around the df payload retrieval"""
        if not query_obj:
            query_obj = self.query_obj()
        cache_key = self.cache_key(query_obj, **kwargs) if query_obj else None
        logger.info("Cache key: {}".format(cache_key))
        is_loaded = False
        stacktrace = None
        df = None
        cached_dttm = datetime.utcnow().isoformat().split(".")[0]
        if cache_key and cache and not self.force:
            cache_value = cache.get(cache_key)
            if cache_value:
                stats_logger.incr("loading_from_cache")
                try:
                    cache_value = pkl.loads(cache_value)
                    df = cache_value["df"]
                    self.query = cache_value["query"]
                    self._any_cached_dttm = cache_value["dttm"]
                    self._any_cache_key = cache_key
                    self.status = utils.QueryStatus.SUCCESS
                    is_loaded = True
                    stats_logger.incr("loaded_from_cache")
                except Exception as e:
                    logger.exception(e)
                    logger.error(
                        "Error reading cache: " + utils.error_msg_from_exception(e)
                    )
                logger.info("Serving from cache")

        if query_obj and not is_loaded:
            try:
                df = self.get_df(query_obj)
                if self.status != utils.QueryStatus.FAILED:
                    stats_logger.incr("loaded_from_source")
                    if not self.force:
                        stats_logger.incr("loaded_from_source_without_force")
                    is_loaded = True
            except Exception as e:
                logger.exception(e)
                if not self.error_message:
                    self.error_message = "{}".format(e)
                self.status = utils.QueryStatus.FAILED
                stacktrace = utils.get_stacktrace()

            if (
                is_loaded
                and cache_key
                and cache
                and self.status != utils.QueryStatus.FAILED
            ):
                try:
                    cache_value = dict(dttm=cached_dttm, df=df, query=self.query)
                    cache_value = pkl.dumps(cache_value, protocol=pkl.HIGHEST_PROTOCOL)

                    logger.info(
                        "Caching {} chars at key {}".format(len(cache_value), cache_key)
                    )

                    stats_logger.incr("set_cache_key")
                    cache.set(cache_key, cache_value, timeout=self.cache_timeout)
                except Exception as e:
                    # cache.set call can fail if the backend is down or if
                    # the key is too large or whatever other reasons
                    logger.warning("Could not cache key {}".format(cache_key))
                    logger.exception(e)
                    cache.delete(cache_key)
        return {
            "cache_key": self._any_cache_key,
            "cached_dttm": self._any_cached_dttm,
            "cache_timeout": self.cache_timeout,
            "df": df,
            "error": self.error_message,
            "form_data": self.form_data,
            "is_cached": self._any_cache_key is not None,
            "query": self.query,
            "status": self.status,
            "stacktrace": stacktrace,
            "rowcount": len(df.index) if df is not None else 0,
        }

    def json_dumps(self, obj, sort_keys=False):
        return json.dumps(
            obj, default=utils.json_int_dttm_ser, ignore_nan=True, sort_keys=sort_keys
        )

    def payload_json_and_has_error(self, payload):
        has_error = (
            payload.get("status") == utils.QueryStatus.FAILED
            or payload.get("error") is not None
        )
        return self.json_dumps(payload), has_error

    @property
    def data(self):
        """This is the data object serialized to the js layer"""
        content = {
            "form_data": self.form_data,
            "token": self.token,
            "viz_name": self.viz_type,
            "filter_select_enabled": self.datasource.filter_select_enabled,
        }
        return content

    def get_excel(self):
        get_excel_output = getattr(self, "get_excel_output", None)
        if not callable(get_excel_output):
            raise NameError('get_excel should only be called by viz that have get_excel_output method')
        excel_output = self.get_excel_output()


        taskId = self.form_data["taskId"]

        if (taskId is not None):
            viz_type = self.form_data["viz_type"]
            data = aai_loads(aai_dumps(task_types[viz_type].AsyncResult(taskId).get()))
        else:
            data = self.get_payload()

        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            for sheet in excel_output:
                try:
                    data_loc = sheet['location']
                    get_data = sheet['get_data']

                    df_input = data
                    for next_loc in data_loc:
                        df_input = df_input[next_loc]

                    df = get_data(df_input)
                    if df is not None:
                        df.to_excel(writer, sheet_name=sheet['name'])
                except Exception as e:
                    logger.warning(e)
                    continue
        output.seek(0)

        return output

    def get_csv(self):
        df = self.get_df()
        include_index = not isinstance(df.index, pd.RangeIndex)
        return df.to_csv(index=include_index, **config.get("CSV_EXPORT"))

    def create_table_from_df(self, tbl_name, database, schema, df):
        return df.to_sql(tbl_name,
                         database.get_sqla_engine(),
                         if_exists="replace",
                         chunksize=500,
                         index=False,
                         schema=schema)

    def get_data(self, df: pd.DataFrame) -> VizData:
        return df.to_dict(orient="records")

    @property
    def json_data(self):
        return json.dumps(self.data)

    def get_csv_custom(self):
        viz_type = self.form_data["viz_type"]
        taskId = self.form_data["taskId"]
        csv = ""
        if viz_type == "plotly_prediction":
            task = forecast_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()["data"]
                csv = self.time_series_csv(data)
        elif viz_type == "classification_prediction":
            task = classification_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                taskResult = task.get()
                data = aai_loads(aai_dumps(taskResult["data"]))
                csv = self.prediction_csv(data)
        elif viz_type == "regression_prediction":
            task = regression_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                taskResult = task.get()
                data = aai_loads(aai_dumps(taskResult["data"]))
                csv = self.prediction_csv(data)
        elif viz_type == "plotly_tsne":
            task = clustering_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()
                csv = self.segmentation_csv(data["data"])
        elif viz_type == "clean_data":
            task = data_imputation_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                csv = self.data_clean_csv(task.get())
        elif viz_type == "plotly_correlation":
            task = correlation_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()
                csv = self.correlation_csv(data["data"])
        elif viz_type == "sentiment_analysis":
            task = sentiment_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()
                csv = self.sentiment_csv(data["data"])
        elif viz_type == "causal_inference":
            task = causal_inference_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()
                csv = pd.DataFrame(data["data"]["effect"]).to_csv(index=False)
        elif viz_type == "bayesian_regression":
            task = bayesian_regression_task.AsyncResult(taskId)
            if task.state == "SUCCESS":
                data = task.get()
                csv = pd.DataFrame(data["data"]["prediction_table"]).to_csv(index=False)

        return csv

    def correlation_csv(self, data):
        return pd.DataFrame(data["corr"]).to_csv(index=False)

    def data_csv(self, data):
        columns = data["data"]["columns"]
        records = data["data"]["records"]
        csv = ""
        # add header
        for i in range(len(columns)):
            csv += str(columns[i])
            # add , each item, last item add enter character
            if i < len(columns)-1:
                csv += ","
            else:
                csv += "\n"
        # add content
        for row in range(len(records)):
            count = 0
            for k in records[row]:
                count += 1
                csv += str(records[row][k])
                # add , each item, last item add enter character
                if count < len(records[row]):
                    csv += ","
                elif row < len(records)-1:
                    csv += "\n"
        return csv

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        security_manager.raise_for_access(viz=self)

    def prediction_csv(self,data):
        if "prediction_table" in data:
            return pd.DataFrame({c: data["prediction_table"]["data"][c] \
                                    for c in data["prediction_table"]["columns"]}).to_csv(index=False)

        elif "predictData" in data:
            return pd.concat([
                pd.DataFrame(data["exdata"]),
                pd.DataFrame(data["predictData"])
            ], axis=0).to_csv(index=False)


    def time_series_csv(self, data):
        series = {}
        for batch in data["predict"]:
            for p in batch:
                past_len = len(p["value"]["data"]["date"])
                dates = p["value"]["data"]["date"] + p["value"]["prediction"]["date"]
                values = p["value"]["data"]["value"] + p["value"]["prediction"]["median"]
                lows = [""]*past_len + p["value"]["prediction"]["min"]
                highs = [""]*past_len + p["value"]["prediction"]["max"]

                series[p["name"]] = pd.Series(values, index=dates)
                series[p["name"] + "_low"] = pd.Series(lows, index=dates)
                series[p["name"] + "_high"] = pd.Series(highs, index=dates)
        return pd.DataFrame(series).to_csv(index=True)

    def segmentation_csv(self, data):
        csv = ""
        line_count = len(data)
        csv += "cluster_id,train_x,train_y, "
        if line_count > 0:
            column_key = self.getList(data[0]["value"][0]["column"])
            for key in column_key:
                csv += f'{key},'
            csv += "\n"
            for k in range(len(data)):
                for j in range(len(data[k]["value"])):
                    csv += f'{data[k]["cluster_id"]},{data[k]["value"][j]["train"]["x"]},{data[k]["value"][j]["train"]["y"]},'
                    for key in column_key:
                        csv += f'{data[k]["value"][j]["column"].get(key)},'
                    csv += "\n"
        return csv

    def data_clean_csv(self, data):
        csv = ""
        columns = data["columns"]
        records = data["records"]
        for c in columns:
            csv += f'{c},'
        csv += "\n"
        for r in records:
            for c in columns:
                csv += f'{r["text"].get(c)},'
            csv += "\n"

        return csv

    def sentiment_csv(self, data):
        return pd.DataFrame(data).to_csv(index=False)

    def getList(self, dict):
        return dict.keys()


class TableViz(BaseViz):

    """A basic html table that is sortable and searchable"""

    viz_type = "table"
    verbose_name = _("Table View")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False
    enforce_numerical_metrics = False

    def should_be_timeseries(self):
        fd = self.form_data
        # TODO handle datasource-type-specific code in datasource
        conditions_met = (fd.get("granularity") and fd.get("granularity") != "all") or (
            fd.get("granularity_sqla") and fd.get("time_grain_sqla")
        )
        if fd.get("include_time") and not conditions_met:
            raise Exception(
                _("Pick a granularity in the Time section or " "uncheck 'Include Time'")
            )
        return fd.get("include_time")

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data

        if fd.get("all_columns") and (
            fd.get("groupby") or fd.get("metrics") or fd.get("percent_metrics")
        ):
            raise Exception(
                _(
                    "Choose either fields to [Group By] and [Metrics] and/or "
                    "[Percentage Metrics], or [Columns], not both"
                )
            )

        sort_by = fd.get("timeseries_limit_metric")
        order_by = fd.get('order_by')

        if not (fd.get('metrics') or fd.get('percent_metrics')):
            if fd.get('dictint'):
                d["groupby"] = fd.get("all_columns")
                if order_by:
                    sort_by_label = utils.get_metric_name(order_by)
                    if sort_by_label not in utils.get_metric_names(d["metrics"]):
                        d["metrics"] += [order_by]
                    d["orderby"] = [(order_by, not fd.get("order_desc", True))]
            else:
                d["columns"] = fd.get("all_columns")
                order_by = fd.get("order_by") or []
                order_by_cols = []
                for t in order_by:
                    order_by_cols.append([t, not fd.get('order_desc', True)])
                d["orderby"] = order_by_cols

        else:
            d["groupby"] = fd.get("groupby")
            if order_by:
                sort_by_label = utils.get_metric_name(order_by)
                if sort_by_label not in utils.get_metric_names(d["metrics"]):
                    d["metrics"] += [order_by]
                d["orderby"] = [(order_by, not fd.get("order_desc", True))]

        # Add all percent metrics that are not already in the list
        if "percent_metrics" in fd:
            d["metrics"].extend(
                m for m in fd["percent_metrics"] or [] if m not in d["metrics"]
            )

        d["is_timeseries"] = self.should_be_timeseries()
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        """
        Transform the query result to the table representation.

        :param df: The interim dataframe
        :returns: The table visualization data

        The interim dataframe comprises of the group-by and non-group-by columns and
        the union of the metrics representing the non-percent and percent metrics. Note
        the percent metrics have yet to be transformed.
        """

        non_percent_metric_columns = []
        # Transform the data frame to adhere to the UI ordering of the columns and
        # metrics whilst simultaneously computing the percentages (via normalization)
        # for the percent metrics.

        if DTTM_ALIAS in df:
            if self.should_be_timeseries():
                non_percent_metric_columns.append(DTTM_ALIAS)
            else:
                del df[DTTM_ALIAS]

        non_percent_metric_columns.extend(
            self.form_data.get("all_columns") or self.form_data.get("groupby") or []
        )

        non_percent_metric_columns.extend(
            utils.get_metric_names(self.form_data.get("metrics") or [])
        )

        timeseries_limit_metric = utils.get_metric_name(
            self.form_data.get("timeseries_limit_metric")
        )
        if timeseries_limit_metric:
            non_percent_metric_columns.append(timeseries_limit_metric)

        percent_metric_columns = utils.get_metric_names(
            self.form_data.get("percent_metrics") or []
        )

        df = pd.concat(
            [
                df[non_percent_metric_columns],
                (
                    df[percent_metric_columns]
                    .div(df[percent_metric_columns].sum())
                    .add_prefix("%")
                ),
            ],
            axis=1,
        )

        data = self.handle_js_int_overflow(
            dict(records=df.to_dict(orient="records"), columns=list(df.columns))
        )

        return data

    def json_dumps(self, obj, sort_keys=False):
        return json.dumps(
            obj, default=utils.json_iso_dttm_ser, sort_keys=sort_keys, ignore_nan=True
        )



class TimeTableViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "time_table"
    verbose_name = _("Time Table View")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = True

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data

        if not fd.get("metrics"):
            raise Exception(_("Pick at least one metric"))

        if fd.get("groupby") and len(fd.get("metrics")) > 1:
            raise Exception(
                _("When using 'Group By' you are limited to use a single metric")
            )
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data
        columns = None
        values = self.metric_labels
        if fd.get("groupby"):
            values = self.metric_labels[0]
            columns = fd.get("groupby")
        pt = df.pivot_table(index=DTTM_ALIAS, columns=columns, values=values)
        pt.index = pt.index.map(str)
        pt = pt.sort_index()
        return dict(
            records=pt.to_dict(orient="index"),
            columns=list(pt.columns),
            is_group_by=len(fd.get("groupby", [])) > 0,
        )


class PivotTableViz(BaseViz):

    """A pivot table view, define your rows, columns and metrics"""

    viz_type = "pivot_table"
    verbose_name = _("Pivot Table")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        d = super().query_obj()
        groupby = self.form_data.get("groupby")
        columns = self.form_data.get("columns")
        metrics = self.form_data.get("metrics")
        transpose = self.form_data.get("transpose_pivot")
        if not columns:
            columns = []
        if not groupby:
            groupby = []
        if not groupby:
            raise Exception(_("Please choose at least one 'Group by' field "))
        if transpose and not columns:
            raise Exception(
                _(
                    (
                        "Please choose at least one 'Columns' field when "
                        "select 'Transpose Pivot' option"
                    )
                )
            )
        if not metrics:
            raise Exception(_("Please choose at least one metric"))
        if set(groupby) & set(columns):
            raise Exception(_("Group By' and 'Columns' can't overlap"))
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        if self.form_data.get("granularity") == "all" and DTTM_ALIAS in df:
            del df[DTTM_ALIAS]

        aggfunc = self.form_data.get("pandas_aggfunc") or "sum"

        # Ensure that Pandas's sum function mimics that of SQL.
        if aggfunc == "sum":
            aggfunc = lambda x: x.sum(min_count=1)  # noqa: E731

        groupby = self.form_data.get("groupby")
        columns = self.form_data.get("columns")
        if self.form_data.get("transpose_pivot"):
            groupby, columns = columns, groupby
        metrics = [utils.get_metric_name(m) for m in self.form_data["metrics"]]
        df = df.pivot_table(
            index=groupby,
            columns=columns,
            values=metrics,
            aggfunc=aggfunc,
            margins=self.form_data.get("pivot_margins"),
        )

        # Re-order the columns adhering to the metric ordering.
        df = df[metrics]

        # Display metrics side by side with each column
        if self.form_data.get("combine_metric"):
            df = df.stack(0).unstack()
        return dict(
            columns=list(df.columns),
            html=df.to_html(
                na_rep="null",
                classes=(
                    "dataframe table table-striped table-bordered "
                    "table-condensed table-hover"
                ).split(" "),
            ),
        )


class MarkupViz(BaseViz):

    """Use html or markdown to create a free form widget"""

    viz_type = "markup"
    verbose_name = _("Markup")
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        return pd.DataFrame()

    def get_data(self, df: pd.DataFrame) -> VizData:
        markup_type = self.form_data.get("markup_type")
        code = self.form_data.get("code", "")
        if markup_type == "markdown":
            code = markdown(code)
        return dict(html=code, theme_css=get_manifest_files("theme", "css"))


class SeparatorViz(MarkupViz):

    """Use to create section headers in a dashboard, similar to `Markup`"""

    viz_type = "separator"
    verbose_name = _("Separator")


class WordCloudViz(BaseViz):

    """Build a colorful word cloud
    Uses the nice library at:
    https://github.com/jasondavies/d3-cloud
    """

    viz_type = "word_cloud"
    verbose_name = _("Word Cloud")
    is_timeseries = False

    def query_obj(self):
        d = super().query_obj()
        d["groupby"] = [self.form_data.get("series")]
        return d


class SentimentViz(BaseViz):

    """Build a colorful word cloud

    Uses the nice library at:
    https://github.com/jasondavies/d3-cloud
    """

    viz_type = "sentiment_analysis"
    verbose_name = _("Sentiment Analysis")
    is_timeseries = False

    def get_excel_output(self):
        return [{
            'name': 'Context',
            'location': ['data'],
            'get_data': pd.DataFrame.from_records
        }]

    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        series = self.form_data.get("series")
        filters = form_data.get("adhoc_filters")
        taskId = form_data.get("taskId")

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = sentiment_task.delay(
                datasource_id, series, filters, user_id=g.user.get_id())
            taskId = task.id

        return {
            "messenger": "",
            "status": "PROCESSING",
            "taskId": taskId,
            "validations": [],
            "data": {},
        }


class TreemapViz(BaseViz):

    """Tree map visualisation for hierarchical data."""

    viz_type = "treemap"
    verbose_name = _("Treemap")
    credits = '<a href="https://d3js.org">d3.js</a>'
    is_timeseries = False

    def _nest(self, metric, df):
        nlevels = df.index.nlevels
        if nlevels == 1:
            result = [{"name": n, "value": v} for n, v in zip(df.index, df[metric])]
        else:
            result = [
                {"name": l, "children": self._nest(metric, df.loc[l])}
                for l in df.index.levels[0]
            ]
        return result

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        df = df.set_index(self.form_data.get("groupby"))
        chart_data = [
            {"name": metric, "children": self._nest(metric, df)}
            for metric in df.columns
        ]
        return chart_data


class CalHeatmapViz(BaseViz):

    """Calendar heatmap."""

    viz_type = "cal_heatmap"
    verbose_name = _("Calendar Heatmap")
    credits = "<a href=https://github.com/wa0x6e/cal-heatmap>cal-heatmap</a>"
    is_timeseries = True

    def get_data(self, df: pd.DataFrame) -> VizData:
        form_data = self.form_data

        data = {}
        records = df.to_dict("records")
        for metric in self.metric_labels:
            values = {}
            for obj in records:
                v = obj[DTTM_ALIAS]
                if hasattr(v, "value"):
                    v = v.value
                values[str(v / 10 ** 9)] = obj.get(metric)
            data[metric] = values

        start, end = utils.get_since_until(
            relative_start=relative_start,
            relative_end=relative_end,
            time_range=form_data.get("time_range"),
            since=form_data.get("since"),
            until=form_data.get("until"),
        )
        if not start or not end:
            raise Exception("Please provide both time bounds (Since and Until)")
        domain = form_data.get("domain_granularity")
        diff_delta = rdelta.relativedelta(end, start)
        diff_secs = (end - start).total_seconds()

        if domain == "year":
            range_ = diff_delta.years + 1
        elif domain == "month":
            range_ = diff_delta.years * 12 + diff_delta.months + 1
        elif domain == "week":
            range_ = diff_delta.years * 53 + diff_delta.weeks + 1
        elif domain == "day":
            range_ = diff_secs // (24 * 60 * 60) + 1  # type: ignore
        else:
            range_ = diff_secs // (60 * 60) + 1  # type: ignore

        return {
            "data": data,
            "start": start,
            "domain": domain,
            "subdomain": form_data.get("subdomain_granularity"),
            "range": range_,
        }

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data
        d["metrics"] = fd.get("metrics")
        return d


class NVD3Viz(BaseViz):

    """Base class for all nvd3 vizs"""

    credits = '<a href="http://nvd3.org/">NVD3.org</a>'
    viz_type = None
    verbose_name = "Base NVD3 Viz"
    is_timeseries = False


class BoxPlotViz(NVD3Viz):

    """Box plot viz from ND3"""

    viz_type = "box_plot"
    verbose_name = _("Box Plot")
    sort_series = False
    is_timeseries = False

    def query_obj(self):
        query_obj = super().query_obj()
        query_obj["columns"] = query_obj["groupby"] + query_obj["metrics"]
        query_obj["metrics"] = []
        query_obj["groupby"] = []
        logging.info("query object: %s" % query_obj)
        return query_obj

    def to_series(self, df, classed="", title_suffix=""):
        label_sep = " - "
        chart_data = []
        for index_value, row in zip(df.index, df.to_dict(orient="records")):
            if isinstance(index_value, tuple):
                index_value = label_sep.join(index_value)
            boxes = defaultdict(dict)
            for (label, key), value in row.items():
                if key == "nanmedian":
                    key = "Q2"
                boxes[label][key] = value
            for label, box in boxes.items():
                chart_label = index_value
                chart_data.append({"label": chart_label, "values": box})
        return chart_data

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        form_data = self.form_data

        # conform to NVD3 names
        def Q1(series):  # need to be named functions - can't use lambdas
            return np.nanpercentile(series, 25)

        def Q3(series):
            return np.nanpercentile(series, 75)

        whisker_type = form_data.get("whisker_options")
        if whisker_type == "Tukey":

            def whisker_high(series):
                upper_outer_lim = Q3(series) + 1.5 * (Q3(series) - Q1(series))
                return series[series <= upper_outer_lim].max()

            def whisker_low(series):
                lower_outer_lim = Q1(series) - 1.5 * (Q3(series) - Q1(series))
                return series[series >= lower_outer_lim].min()

        elif whisker_type == "Min/max (no outliers)":

            def whisker_high(series):
                return series.max()

            def whisker_low(series):
                return series.min()

        elif " percentiles" in whisker_type:  # type: ignore
            low, high = whisker_type.replace(" percentiles", "").split(  # type: ignore
                "/"
            )

            def whisker_high(series):
                return np.nanpercentile(series, int(high))

            def whisker_low(series):
                return np.nanpercentile(series, int(low))

        else:
            raise ValueError("Unknown whisker type: {}".format(whisker_type))

        def outliers(series):
            above = series[series > whisker_high(series)]
            below = series[series < whisker_low(series)]
            # pandas sometimes doesn't like getting lists back here
            return set(above.tolist() + below.tolist())

        aggregate = [Q1, np.nanmedian, Q3, whisker_high, whisker_low, outliers]
        df = df.groupby(form_data.get("groupby")).agg(aggregate)
        chart_data = self.to_series(df)
        return chart_data


class BubbleViz(NVD3Viz):

    """Based on the NVD3 bubble chart"""

    viz_type = "bubble"
    verbose_name = _("Bubble Chart")
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super().query_obj()
        d["groupby"] = [form_data.get("entity")]
        if form_data.get("series"):
            d["groupby"].append(form_data.get("series"))

        # dedup groupby if it happens to be the same
        d["groupby"] = list(dict.fromkeys(d["groupby"]))

        self.x_metric = form_data.get("x")
        self.y_metric = form_data.get("y")
        self.z_metric = form_data.get("size")
        self.entity = form_data.get("entity")
        self.series = form_data.get("series") or self.entity
        d["row_limit"] = form_data.get("limit")

        d["metrics"] = [self.z_metric, self.x_metric, self.y_metric]
        if len(set(self.metric_labels)) < 3:
            raise Exception(_("Please use 3 different metric labels"))
        if not all(d["metrics"] + [self.entity]):
            raise Exception(_("Pick a metric for x, y and size"))
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        df["x"] = df[[utils.get_metric_name(self.x_metric)]]
        df["y"] = df[[utils.get_metric_name(self.y_metric)]]
        df["size"] = df[[utils.get_metric_name(self.z_metric)]]
        df["shape"] = "circle"
        df["group"] = df[[self.series]]

        series: Dict[Any, List[Any]] = defaultdict(list)
        for row in df.to_dict(orient="records"):
            series[row["group"]].append(row)
        chart_data = []
        for k, v in series.items():
            chart_data.append({"key": k, "values": v})
        return chart_data

class PlotlyBubbleViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "plotly_bubble"
    verbose_name = _("Timeline Bubble")
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super().query_obj()
        d["groupby"] = [form_data.get("timeline")]
        if form_data.get("group"):
            d["groupby"].append(form_data.get("group"))
        self.x_metric = form_data.get("x")
        self.y_metric = form_data.get("y")
        self.z_metric = form_data.get("size")
        self.group = form_data.get("group")
        self.timeline = form_data.get("timeline")
        d["row_limit"] = form_data.get("limit")

        d["metrics"] = [self.z_metric, self.x_metric, self.y_metric]
        if len(set(self.metric_labels)) < 3:
            raise Exception(_("Please use 3 different metric labels"))
        if not all(d["metrics"]):
            raise Exception(_("Pick a metric for x, y and size"))
        return d

    def get_data(self, df):
        df["x"] = df[[utils.get_metric_name(self.x_metric)]]
        df["y"] = df[[utils.get_metric_name(self.y_metric)]]
        df["size"] = df[[utils.get_metric_name(self.z_metric)]]
        df["shape"] = "circle"
        df["group"] = df[[self.timeline]]

        timeline = defaultdict(list)
        for row in df.to_dict(orient="records"):
            timeline[row["group"]].append(row)
        chart_data = []
        for k, v in timeline.items():
            item = []
            for i in v:
                subItem = {}
                for j in i:
                    value = i[j]
                    if str(type(value)) == "<class 'pandas._libs.tslibs.timestamps.Timestamp'>":
                        value = str(value)
                    subItem[j] = value
                item.append(subItem)
            key = k
            if str(type(key)) == "<class 'pandas._libs.tslibs.timestamps.Timestamp'>":
                key = str(k)
            chart_data.append({"key": key, "values": item})
        return chart_data

class BulletViz(NVD3Viz):

    """Based on the NVD3 bullet chart"""

    viz_type = "bullet"
    verbose_name = _("Bullet Chart")
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super().query_obj()
        self.metric = form_data.get("metric")

        def as_strings(field):
            value = form_data.get(field)
            return value.split(",") if value else []

        def as_floats(field):
            return [float(x) for x in as_strings(field)]

        self.ranges = as_floats("ranges")
        self.range_labels = as_strings("range_labels")
        self.markers = as_floats("markers")
        self.marker_labels = as_strings("marker_labels")
        self.marker_lines = as_floats("marker_lines")
        self.marker_line_labels = as_strings("marker_line_labels")

        d["metrics"] = [self.metric]
        if not self.metric:
            raise Exception(_("Pick a metric to display"))
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        df["metric"] = df[[utils.get_metric_name(self.metric)]]
        values = df["metric"].values
        return {
            "measures": values.tolist(),
            "ranges": self.ranges or [0, values.max() * 1.1],
            "rangeLabels": self.range_labels or None,
            "markers": self.markers or None,
            "markerLabels": self.marker_labels or None,
            "markerLines": self.marker_lines or None,
            "markerLineLabels": self.marker_line_labels or None,
        }


class BigNumberViz(BaseViz):

    """Put emphasis on a single metric with this big number viz"""

    viz_type = "big_number"
    verbose_name = _("Big Number with Trendline")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = True

    def query_obj(self):
        d = super().query_obj()
        metric = self.form_data.get("metric")
        if not metric:
            raise Exception(_("Pick a metric!"))
        d["metrics"] = [self.form_data.get("metric")]
        self.form_data["metric"] = metric
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        df = df.pivot_table(
            index=DTTM_ALIAS,
            columns=[],
            values=self.metric_labels,
            dropna=False,
            aggfunc=np.min,  # looking for any (only) value, preserving `None`
        )
        df = self.apply_rolling(df)
        df[DTTM_ALIAS] = df.index
        return super().get_data(df)


class BigNumberTotalViz(BaseViz):

    """Put emphasis on a single metric with this big number viz"""

    viz_type = "big_number_total"
    verbose_name = _("Big Number")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        d = super().query_obj()
        metric = self.form_data.get("metric")
        if not metric:
            raise Exception(_("Pick a metric!"))
        d["metrics"] = [self.form_data.get("metric")]
        self.form_data["metric"] = metric

        # Limiting rows is not required as only one cell is returned
        d["row_limit"] = None
        return d


class NVD3TimeSeriesViz(NVD3Viz):

    """A rich line chart component with tons of options"""

    viz_type = "line"
    verbose_name = _("Time Series - Line Chart")
    sort_series = False
    is_timeseries = True
    pivot_fill_value: Optional[int] = None

    def to_series(self, df, classed="", title_suffix=""):
        cols = []
        for col in df.columns:
            if col == "":
                cols.append("N/A")
            elif col is None:
                cols.append("NULL")
            else:
                cols.append(col)
        df.columns = cols
        series = df.to_dict("series")

        chart_data = []
        for name in df.T.index.tolist():
            ys = series[name]
            if df[name].dtype.kind not in "biufc":
                continue
            if isinstance(name, list):
                series_title = [str(title) for title in name]
            elif isinstance(name, tuple):
                series_title = tuple(str(title) for title in name)
            else:
                series_title = str(name)
            if (
                isinstance(series_title, (list, tuple))
                and len(series_title) > 1
                and len(self.metric_labels) == 1
            ):
                # Removing metric from series name if only one metric
                series_title = series_title[1:]
            if title_suffix:
                if isinstance(series_title, str):
                    series_title = (series_title, title_suffix)
                elif isinstance(series_title, (list, tuple)):
                    series_title = series_title + (title_suffix,)

            values = []
            non_nan_cnt = 0
            for ds in df.index:
                if ds in ys:
                    d = {"x": ds, "y": ys[ds]}
                    if not np.isnan(ys[ds]):
                        non_nan_cnt += 1
                else:
                    d = {}
                values.append(d)

            if non_nan_cnt == 0:
                continue

            d = {"key": series_title, "values": values}
            if classed:
                d["classed"] = classed
            chart_data.append(d)
        return chart_data

    def process_data(self, df: pd.DataFrame, aggregate: bool = False) -> VizData:
        fd = self.form_data
        if fd.get("granularity") == "all":
            raise Exception(_("Pick a time granularity for your time series"))

        if df.empty:
            return df

        if aggregate:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get("groupby"),
                values=self.metric_labels,
                fill_value=0,
                aggfunc=sum,
            )
        else:
            df = df.pivot_table(
                index=DTTM_ALIAS,
                columns=fd.get("groupby"),
                values=self.metric_labels,
                fill_value=self.pivot_fill_value,
            )

        rule = fd.get("resample_rule")
        method = fd.get("resample_method")

        if rule and method:
            df = getattr(df.resample(rule), method)()

        if self.sort_series:
            dfs = df.sum()
            dfs.sort_values(ascending=False, inplace=True)
            df = df[dfs.index]

        df = self.apply_rolling(df)
        if fd.get("contribution"):
            dft = df.T
            df = (dft / dft.sum()).T

        return df

    def run_extra_queries(self):
        fd = self.form_data

        time_compare = fd.get("time_compare") or []
        # backwards compatibility
        if not isinstance(time_compare, list):
            time_compare = [time_compare]

        for option in time_compare:
            query_object = self.query_obj()
            delta = utils.parse_past_timedelta(option)
            query_object["inner_from_dttm"] = query_object["from_dttm"]
            query_object["inner_to_dttm"] = query_object["to_dttm"]

            if not query_object["from_dttm"] or not query_object["to_dttm"]:
                raise Exception(
                    _(
                        "`Since` and `Until` time bounds should be specified "
                        "when using the `Time Shift` feature."
                    )
                )
            query_object["from_dttm"] -= delta
            query_object["to_dttm"] -= delta

            df2 = self.get_df_payload(query_object, time_compare=option).get("df")
            if df2 is not None and DTTM_ALIAS in df2:
                label = "{} offset".format(option)
                df2[DTTM_ALIAS] += delta
                df2 = self.process_data(df2)
                self._extra_chart_data.append((label, df2))

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        comparison_type = fd.get("comparison_type") or "values"
        df = self.process_data(df)
        if comparison_type == "values":
            # Filter out series with all NaN
            chart_data = self.to_series(df.dropna(axis=1, how="all"))

            for i, (label, df2) in enumerate(self._extra_chart_data):
                chart_data.extend(
                    self.to_series(
                        df2, classed="time-shift-{}".format(i), title_suffix=label
                    )
                )
        else:
            chart_data = []
            for i, (label, df2) in enumerate(self._extra_chart_data):
                # reindex df2 into the df2 index
                combined_index = df.index.union(df2.index)
                df2 = (
                    df2.reindex(combined_index)
                    .interpolate(method="time")
                    .reindex(df.index)
                )

                if comparison_type == "absolute":
                    diff = df - df2
                elif comparison_type == "percentage":
                    diff = (df - df2) / df2
                elif comparison_type == "ratio":
                    diff = df / df2
                else:
                    raise Exception(
                        "Invalid `comparison_type`: {0}".format(comparison_type)
                    )

                # remove leading/trailing NaNs from the time shift difference
                diff = diff[diff.first_valid_index() : diff.last_valid_index()]

                chart_data.extend(
                    self.to_series(
                        diff, classed="time-shift-{}".format(i), title_suffix=label
                    )
                )

        if not self.sort_series:
            chart_data = sorted(chart_data, key=lambda x: tuple(x["key"]))
        return chart_data


class MultiLineViz(NVD3Viz):

    """Pile on multiple line charts"""

    viz_type = "line_multi"
    verbose_name = _("Time Series - Multiple Line Charts")

    is_timeseries = True

    def query_obj(self):
        return None

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        # Late imports to avoid circular import issues
        from superset.models.slice import Slice
        from superset import db

        slice_ids1 = fd.get("line_charts")
        slices1 = db.session.query(Slice).filter(Slice.id.in_(slice_ids1)).all()
        slice_ids2 = fd.get("line_charts_2")
        slices2 = db.session.query(Slice).filter(Slice.id.in_(slice_ids2)).all()
        return {
            "slices": {
                "axis1": [slc.data for slc in slices1],
                "axis2": [slc.data for slc in slices2],
            }
        }


class NVD3DualLineViz(NVD3Viz):

    """A rich line chart with dual axis"""

    viz_type = "dual_line"
    verbose_name = _("Time Series - Dual Axis Line Chart")
    sort_series = False
    is_timeseries = True

    def query_obj(self):
        d = super().query_obj()
        m1 = self.form_data.get("metric")
        m2 = self.form_data.get("metric_2")
        d["metrics"] = [m1, m2]
        if not m1:
            raise Exception(_("Pick a metric for left axis!"))
        if not m2:
            raise Exception(_("Pick a metric for right axis!"))
        if m1 == m2:
            raise Exception(
                _("Please choose different metrics" " on left and right axis")
            )
        return d

    def to_series(self, df, classed=""):
        cols = []
        for col in df.columns:
            if col == "":
                cols.append("N/A")
            elif col is None:
                cols.append("NULL")
            else:
                cols.append(col)
        df.columns = cols
        series = df.to_dict("series")
        chart_data = []
        metrics = [self.form_data.get("metric"), self.form_data.get("metric_2")]
        for i, m in enumerate(metrics):
            m = utils.get_metric_name(m)
            ys = series[m]
            if df[m].dtype.kind not in "biufc":
                continue
            series_title = m
            d = {
                "key": series_title,
                "classed": classed,
                "values": [
                    {"x": ds, "y": ys[ds] if ds in ys else None} for ds in df.index
                ],
                "yAxis": i + 1,
                "type": "line",
            }
            chart_data.append(d)
        return chart_data

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data

        if self.form_data.get("granularity") == "all":
            raise Exception(_("Pick a time granularity for your time series"))

        metric = utils.get_metric_name(fd.get("metric"))
        metric_2 = utils.get_metric_name(fd.get("metric_2"))
        df = df.pivot_table(index=DTTM_ALIAS, values=[metric, metric_2])

        chart_data = self.to_series(df)
        return chart_data


class NVD3TimeSeriesBarViz(NVD3TimeSeriesViz):

    """A bar chart where the x axis is time"""

    viz_type = "bar"
    sort_series = True
    verbose_name = _("Time Series - Bar Chart")


class NVD3TimePivotViz(NVD3TimeSeriesViz):

    """Time Series - Periodicity Pivot"""

    viz_type = "time_pivot"
    sort_series = True
    verbose_name = _("Time Series - Period Pivot")

    def query_obj(self):
        d = super().query_obj()
        d["metrics"] = [self.form_data.get("metric")]
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data
        df = self.process_data(df)
        freq = to_offset(fd.get("freq"))
        try:
            freq = type(freq)(freq.n, normalize=True, **freq.kwds)
        except ValueError:
            freq = type(freq)(freq.n, **freq.kwds)
        df.index.name = None
        df[DTTM_ALIAS] = df.index.map(freq.rollback)
        df["ranked"] = df[DTTM_ALIAS].rank(method="dense", ascending=False) - 1
        df.ranked = df.ranked.map(int)
        df["series"] = "-" + df.ranked.map(str)
        df["series"] = df["series"].str.replace("-0", "current")
        rank_lookup = {
            row["series"]: row["ranked"] for row in df.to_dict(orient="records")
        }
        max_ts = df[DTTM_ALIAS].max()
        max_rank = df["ranked"].max()
        df[DTTM_ALIAS] = df.index + (max_ts - df[DTTM_ALIAS])
        df = df.pivot_table(
            index=DTTM_ALIAS,
            columns="series",
            values=utils.get_metric_name(fd.get("metric")),
        )
        chart_data = self.to_series(df)
        for serie in chart_data:
            serie["rank"] = rank_lookup[serie["key"]]
            serie["perc"] = 1 - (serie["rank"] / (max_rank + 1))
        return chart_data


class NVD3CompareTimeSeriesViz(NVD3TimeSeriesViz):

    """A line chart component where you can compare the % change over time"""

    viz_type = "compare"
    verbose_name = _("Time Series - Percent Change")


class NVD3TimeSeriesStackedViz(NVD3TimeSeriesViz):

    """A rich stack area chart"""

    viz_type = "area"
    verbose_name = _("Time Series - Stacked")
    sort_series = True
    pivot_fill_value = 0


class DistributionPieViz(NVD3Viz):

    """Annoy visualization snobs with this controversial pie chart"""

    viz_type = "pie"
    verbose_name = _("Distribution - NVD3 - Pie Chart")
    is_timeseries = False

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None
        metric = self.metric_labels[0]
        df = df.pivot_table(index=self.groupby, values=[metric])
        df.sort_values(by=metric, ascending=False, inplace=True)
        df = df.reset_index()
        df.columns = ["x", "y"]
        return df.to_dict(orient="records")


class HistogramViz(BaseViz):

    """Histogram"""

    viz_type = "histogram"
    verbose_name = _("Histogram")
    is_timeseries = False

    def query_obj(self):
        """Returns the query object for this visualization"""
        d = super().query_obj()
        d["row_limit"] = self.form_data.get(
            "row_limit", int(config.get("VIZ_ROW_LIMIT"))
        )
        numeric_columns = self.form_data.get("all_columns_x")
        if numeric_columns is None:
            raise Exception(_("Must have at least one numeric column specified"))
        self.columns = numeric_columns
        d["columns"] = numeric_columns + self.groupby
        # override groupby entry to avoid aggregation
        d["groupby"] = []
        return d

    def labelify(self, keys, column):
        if isinstance(keys, str):
            keys = (keys,)
        # removing undesirable characters
        labels = [re.sub(r"\W+", r"_", k) for k in keys]
        if len(self.columns) > 1 or not self.groupby:
            # Only show numeric column in label if there are many
            labels = [column] + labels
        return "__".join(labels)

    def get_data(self, df: pd.DataFrame) -> VizData:
        """Returns the chart data"""
        if df.empty:
            return None

        chart_data = []
        if len(self.groupby) > 0:
            groups = df.groupby(self.groupby)
        else:
            groups = [((), df)]
        for keys, data in groups:
            chart_data.extend(
                [
                    {
                        "key": self.labelify(keys, column),
                        "values": data[column].tolist(),
                    }
                    for column in self.columns
                ]
            )
        return chart_data


class DistributionBarViz(DistributionPieViz):

    """A good old bar chart"""

    viz_type = "dist_bar"
    verbose_name = _("Distribution - Bar Chart")
    is_timeseries = False

    def query_obj(self):
        d = super().query_obj()  # noqa
        fd = self.form_data
        if len(d["groupby"]) < len(fd.get("groupby") or []) + len(
            fd.get("columns") or []
        ):
            raise Exception(_("Can't have overlap between Series and Breakdowns"))
        if not fd.get("metrics"):
            raise Exception(_("Pick at least one metric"))
        if not fd.get("groupby"):
            raise Exception(_("Pick at least one field for [Series]"))
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data
        metrics = self.metric_labels
        columns = fd.get("columns") or []

        # pandas will throw away nulls when grouping/pivoting,
        # so we substitute NULL_STRING for any nulls in the necessary columns
        filled_cols = self.groupby + columns
        df[filled_cols] = df[filled_cols].fillna(value=NULL_STRING)

        row = df.groupby(self.groupby).sum()[metrics[0]].copy()
        row.sort_values(ascending=False, inplace=True)
        pt = df.pivot_table(index=self.groupby, columns=columns, values=metrics)
        if fd.get("contribution"):
            pt = pt.T
            pt = (pt / pt.sum()).T
        pt = pt.reindex(row.index)
        chart_data = []
        for name, ys in pt.items():
            if pt[name].dtype.kind not in "biufc" or name in self.groupby:
                continue
            if isinstance(name, str):
                series_title = name
            else:
                offset = 0 if len(metrics) > 1 else 1
                series_title = ", ".join([str(s) for s in name[offset:]])
            values = []
            for i, v in ys.items():
                x = i
                if isinstance(x, (tuple, list)):
                    x = ", ".join([str(s) for s in x])
                else:
                    x = str(x)
                values.append({"x": x, "y": v})
            d = {"key": series_title, "values": values}
            chart_data.append(d)
        return chart_data


class PlotlyBarViz(DistributionPieViz):
    """
    Bar chart with error bar
    @author: Tung Nguyen
    @created at: 10/24/2019
    """

    viz_type = "plotly_bar"
    verbose_name = _("Distribution - Bar Chart")
    is_timeseries = False

    """
    Query Object
    @author: Tung Nguyen
    @created at: 10/24/2019
    """
    def query_obj(self):
        d = super().query_obj()  # noqa
        fd = self.form_data
        if len(d["groupby"]) < len(fd.get("groupby") or []) + len(
                fd.get("columns") or []
        ):
            raise Exception(_("Can't have overlap between Series and Breakdowns"))
        if not fd.get("metric"):
            raise Exception(_("Pick at least one metric"))
        if not fd.get("groupby"):
            raise Exception(_("Pick at least one field for [Series]"))
        return d

    """
    Get Data Response To Front-End
    @author: Tung Nguyen
    @created at: 10/24/2019
    """
    def get_data(self, df):
        fd = self.form_data
        metrics = self.metric_labels

        row = df.groupby(self.groupby).sum()[metrics[0]].copy()
        row.sort_values(ascending=False, inplace=True)
        columns = fd.get("columns") or []
        columns_no = []
        pt = df.pivot_table(index=self.groupby, columns=columns, values=metrics)

        if fd.get("contribution"):
            pt = pt.T
            pt = (pt / pt.sum()).T
        pt = pt.reindex(row.index)
        chart = {}
        chart['chart'] = self.return_chart_data(metrics, pt, True)
        return chart

    """
    Return chart data
    @author: Tung Nguyen
    @created at: 10/24/2019
    """
    def return_chart_data(self, metrics, pivotTable, dtype = False):
        arrayData = []
        for name, ys in pivotTable.items():
            total = 0
            if dtype is True:
                if pivotTable[name].dtype.kind not in "biufc" or name in self.groupby:
                    continue
            if isinstance(name, str):
                series_title = name
            else:
                offset = 0 if len(metrics) > 1 else 1
                series_title = ", ".join([str(s) for s in name[offset:]])
            values = []
            for i, v in ys.items():
                x = i
                if isinstance(x, (tuple, list)):
                    x = ", ".join([str(s) for s in x])
                else:
                    x = str(x)
                values.append({"x": x, "y": v})
                if math.isnan(v):
                    v = 0
                total += v
            d = {"key": series_title, "values": values, "total": total}
            arrayData.append(d)
        return arrayData


class PlotlyCorrelation(DistributionPieViz):

    """
    Correlation Chart
    @author: Tung Nguyen - 11/05/2019
    """

    viz_type = "plotly_correlation"
    verbose_name = _("Correlation Chart")
    is_timeseries = False
    enforce_numerical_metrics = False

    def query_obj(self):
        return []

    def get_data(self, df):
        datasource_id_type = self.form_data.get("datasource")
        columns = self.form_data.get("columns_name")

        target_column = self.form_data.get("correlation_target")
        target_value = self.form_data.get("correlation_target_value")

        control_columns, control_values = [], []
        for cv_str in self.form_data.get("correlation_control"):
            cv = json.loads(cv_str)
            control_columns.append(cv.get("column"))
            control_values.append(cv.get("value"))

        filters = self.form_data.get("adhoc_filters")
        taskId = self.form_data.get("taskId")
        num_factors = self.form_data.get("number_factors", 20)

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = correlation_task.delay(
                datasource_id, target_column, columns, filters, target_value,
                control_columns=control_columns, control_values=control_values,
                top_k=int(num_factors),
                )
            taskId = task.id
        return {
            "data": [
                {
                    "cluster_id": "",
                    "value": [
                        {
                            "train":{},
                            "column":{},
                        },
                    ],
                }
            ],
            "status": "PROCESSING",
            "taskId": taskId
        }


class SunburstViz(BaseViz):

    """A multi level sunburst chart"""

    viz_type = "sunburst"
    verbose_name = _("Sunburst")
    is_timeseries = False
    credits = (
        "Kerry Rodden "
        '@<a href="https://bl.ocks.org/kerryrodden/7090426">bl.ocks.org</a>'
    )

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        cols = fd.get("groupby") or []
        cols.extend(["m1", "m2"])
        metric = utils.get_metric_name(fd.get("metric"))
        secondary_metric = utils.get_metric_name(fd.get("secondary_metric"))
        if metric == secondary_metric or secondary_metric is None:
            df.rename(columns={df.columns[-1]: "m1"}, inplace=True)
            df["m2"] = df["m1"]
        else:
            df.rename(columns={df.columns[-2]: "m1"}, inplace=True)
            df.rename(columns={df.columns[-1]: "m2"}, inplace=True)

        # Re-order the columns as the query result set column ordering may differ from
        # that listed in the hierarchy.
        df = df[cols]
        return df.to_numpy().tolist()

    def query_obj(self):
        qry = super().query_obj()
        fd = self.form_data
        qry["metrics"] = [fd["metric"]]
        secondary_metric = fd.get("secondary_metric")
        if secondary_metric and secondary_metric != fd["metric"]:
            qry["metrics"].append(secondary_metric)
        return qry


class SankeyViz(BaseViz):

    """A Sankey diagram that requires a parent-child dataset"""

    viz_type = "sankey"
    verbose_name = _("Sankey")
    is_timeseries = False
    credits = '<a href="https://www.npmjs.com/package/d3-sankey">d3-sankey on npm</a>'

    def query_obj(self):
        qry = super().query_obj()
        if len(qry["groupby"]) != 2:
            raise Exception(_("Pick exactly 2 columns as [Source / Target]"))
        qry["metrics"] = [self.form_data["metric"]]
        return qry

    def get_data(self, df: pd.DataFrame) -> VizData:
        df.columns = ["source", "target", "value"]
        df["source"] = df["source"].astype(str)
        df["target"] = df["target"].astype(str)
        recs = df.to_dict(orient="records")

        hierarchy: Dict[str, Set[str]] = defaultdict(set)
        for row in recs:
            hierarchy[row["source"]].add(row["target"])

        def find_cycle(g):
            """Whether there's a cycle in a directed graph"""
            path = set()

            def visit(vertex):
                path.add(vertex)
                for neighbour in g.get(vertex, ()):
                    if neighbour in path or visit(neighbour):
                        return (vertex, neighbour)
                path.remove(vertex)

            for v in g:
                cycle = visit(v)
                if cycle:
                    return cycle

        cycle = find_cycle(hierarchy)
        if cycle:
            raise Exception(
                _(
                    "There's a loop in your Sankey, please provide a tree. "
                    "Here's a faulty link: {}"
                ).format(cycle)
            )
        return recs


class DirectedForceViz(BaseViz):

    """An animated directed force layout graph visualization"""

    viz_type = "directed_force"
    verbose_name = _("Directed Force Layout")
    credits = 'd3noob @<a href="http://bl.ocks.org/d3noob/5141278">bl.ocks.org</a>'
    is_timeseries = False

    def query_obj(self):
        qry = super().query_obj()
        if len(self.form_data["groupby"]) != 2:
            raise Exception(_("Pick exactly 2 columns to 'Group By'"))
        qry["metrics"] = [self.form_data["metric"]]
        return qry

    def get_data(self, df: pd.DataFrame) -> VizData:
        df.columns = ["source", "target", "value"]
        return df.to_dict(orient="records")


class ChordViz(BaseViz):

    """A Chord diagram"""

    viz_type = "chord"
    verbose_name = _("Directed Force Layout")
    credits = '<a href="https://github.com/d3/d3-chord">Bostock</a>'
    is_timeseries = False

    def query_obj(self):
        qry = super().query_obj()
        fd = self.form_data
        qry["groupby"] = [fd.get("groupby"), fd.get("columns")]
        qry["metrics"] = [fd.get("metric")]
        return qry

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        df.columns = ["source", "target", "value"]

        # Preparing a symetrical matrix like d3.chords calls for
        nodes = list(set(df["source"]) | set(df["target"]))
        matrix = {}
        for source, target in product(nodes, nodes):
            matrix[(source, target)] = 0
        for source, target, value in df.to_records(index=False):
            matrix[(source, target)] = value
        m = [[matrix[(n1, n2)] for n1 in nodes] for n2 in nodes]
        return {"nodes": list(nodes), "matrix": m}


class CountryMapViz(BaseViz):

    """A country centric"""

    viz_type = "country_map"
    verbose_name = _("Country Map")
    is_timeseries = False
    credits = "From bl.ocks.org By john-guerra"

    def query_obj(self):
        qry = super().query_obj()
        qry["metrics"] = [self.form_data["metric"]]
        qry["groupby"] = [self.form_data["entity"]]
        return qry

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        cols = [fd.get("entity")]
        metric = self.metric_labels[0]
        cols += [metric]
        ndf = df[cols]
        df = ndf
        df.columns = ["country_id", "metric"]
        d = df.to_dict(orient="records")
        return d


class WorldMapViz(BaseViz):

    """A country centric world map"""

    viz_type = "world_map"
    verbose_name = _("World Map")
    is_timeseries = False
    credits = 'datamaps on <a href="https://www.npmjs.com/package/datamaps">npm</a>'

    def query_obj(self):
        qry = super().query_obj()
        qry["groupby"] = [self.form_data["entity"]]
        return qry

    def get_data(self, df: pd.DataFrame) -> VizData:
        from superset.examples import countries

        fd = self.form_data
        cols = [fd.get("entity")]
        metric = utils.get_metric_name(fd.get("metric"))
        secondary_metric = utils.get_metric_name(fd.get("secondary_metric"))
        columns = ["country", "m1", "m2"]
        if metric == secondary_metric:
            ndf = df[cols]
            ndf["m1"] = df[metric]
            ndf["m2"] = ndf["m1"]
        else:
            if secondary_metric:
                cols += [metric, secondary_metric]
            else:
                cols += [metric]
                columns = ["country", "m1"]
            ndf = df[cols]
        df = ndf
        df.columns = columns
        d = df.to_dict(orient="records")
        for row in d:
            country = None
            if isinstance(row["country"], str):
                country = countries.get(fd.get("country_fieldtype"), row["country"])

            if country:
                row["country"] = country["cca3"]
                row["latitude"] = country["lat"]
                row["longitude"] = country["lng"]
                row["name"] = country["name"]
            else:
                row["country"] = "XXX"
        return d


class FilterBoxViz(BaseViz):

    """A multi filter, multi-choice filter box to make dashboards interactive"""

    viz_type = "filter_box"
    verbose_name = _("Filters")
    is_timeseries = False
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    cache_type = "get_data"
    filter_row_limit = 1000

    def query_obj(self):
        return None

    def run_extra_queries(self):
        qry = super().query_obj()
        filters = self.form_data.get("filter_configs") or []
        qry["row_limit"] = self.filter_row_limit
        self.dataframes = {}
        for flt in filters:
            col = flt.get("column")
            if not col:
                raise Exception(
                    _("Invalid filter configuration, please select a column")
                )
            qry["groupby"] = [col]
            metric = flt.get("metric")
            qry["metrics"] = [metric] if metric else []
            df = self.get_df_payload(query_obj=qry).get("df")
            self.dataframes[col] = df

    def get_data(self, df: pd.DataFrame) -> VizData:
        filters = self.form_data.get("filter_configs") or []
        d = {}
        for flt in filters:
            col = flt.get("column")
            metric = flt.get("metric")
            df = self.dataframes.get(col)
            if df is not None:
                if metric:
                    df = df.sort_values(
                        utils.get_metric_name(metric), ascending=flt.get("asc")
                    )
                    d[col] = [
                        {"id": row[0], "text": row[0], "metric": row[1]}
                        for row in df.itertuples(index=False)
                    ]
                else:
                    df = df.sort_values(col, ascending=flt.get("asc"))
                    d[col] = [
                        {"id": row[0], "text": row[0]}
                        for row in df.itertuples(index=False)
                    ]
        return d


class IFrameViz(BaseViz):

    """You can squeeze just about anything in this iFrame component"""

    viz_type = "iframe"
    verbose_name = _("iFrame")
    credits = 'a <a href="https://github.com/airbnb/superset">Superset</a> original'
    is_timeseries = False

    def query_obj(self):
        return None

    def get_df(self, query_obj: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        return pd.DataFrame()

    def get_data(self, df: pd.DataFrame) -> VizData:
        return {"iframe": True}


class ParallelCoordinatesViz(BaseViz):

    """Interactive parallel coordinate implementation

    Uses this amazing javascript library
    https://github.com/syntagmatic/parallel-coordinates
    """

    viz_type = "para"
    verbose_name = _("Parallel Coordinates")
    credits = (
        '<a href="https://syntagmatic.github.io/parallel-coordinates/">'
        "Syntagmatic's library</a>"
    )
    is_timeseries = False

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data
        d["groupby"] = [fd.get("series")]
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        return df.to_dict(orient="records")


class HeatmapViz(BaseViz):

    """A nice heatmap visualization that support high density through canvas"""

    viz_type = "heatmap"
    verbose_name = _("Heatmap")
    is_timeseries = False
    credits = (
        'inspired from mbostock @<a href="http://bl.ocks.org/mbostock/3074470">'
        "bl.ocks.org</a>"
    )

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data
        d["metrics"] = [fd.get("metric")]
        d["groupby"] = [fd.get("all_columns_x"), fd.get("all_columns_y")]
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data
        x = fd.get("all_columns_x")
        y = fd.get("all_columns_y")
        v = self.metric_labels[0]
        if x == y:
            df.columns = ["x", "y", "v"]
        else:
            df = df[[x, y, v]]
            df.columns = ["x", "y", "v"]
        norm = fd.get("normalize_across")
        overall = False
        max_ = df.v.max()
        min_ = df.v.min()
        if norm == "heatmap":
            overall = True
        else:
            gb = df.groupby(norm, group_keys=False)
            if len(gb) <= 1:
                overall = True
            else:
                df["perc"] = gb.apply(
                    lambda x: (x.v - x.v.min()) / (x.v.max() - x.v.min())
                )
                df["rank"] = gb.apply(lambda x: x.v.rank(pct=True))
        if overall:
            df["perc"] = (df.v - min_) / (max_ - min_)
            df["rank"] = df.v.rank(pct=True)
        return {"records": df.to_dict(orient="records"), "extents": [min_, max_]}


class HorizonViz(NVD3TimeSeriesViz):

    """Horizon chart

    https://www.npmjs.com/package/d3-horizon-chart
    """

    viz_type = "horizon"
    verbose_name = _("Horizon Charts")
    credits = (
        '<a href="https://www.npmjs.com/package/d3-horizon-chart">'
        "d3-horizon-chart</a>"
    )


class MapboxViz(BaseViz):

    """Rich maps made with Mapbox"""

    viz_type = "mapbox"
    verbose_name = _("Mapbox")
    is_timeseries = False
    credits = "<a href=https://www.mapbox.com/mapbox-gl-js/api/>Mapbox GL JS</a>"

    def query_obj(self):
        d = super().query_obj()
        fd = self.form_data
        label_col = fd.get("mapbox_label")

        if not fd.get("groupby"):
            if fd.get("all_columns_x") is None or fd.get("all_columns_y") is None:
                raise Exception(_("[Longitude] and [Latitude] must be set"))
            d["columns"] = [fd.get("all_columns_x"), fd.get("all_columns_y")]

            if label_col and len(label_col) >= 1:
                if label_col[0] == "count":
                    raise Exception(
                        _(
                            "Must have a [Group By] column to have 'count' as the "
                            + "[Label]"
                        )
                    )
                d["columns"].append(label_col[0])

            if fd.get("point_radius") != "Auto":
                d["columns"].append(fd.get("point_radius"))

            d["columns"] = list(set(d["columns"]))
        else:
            # Ensuring columns chosen are all in group by
            if (
                label_col
                and len(label_col) >= 1
                and label_col[0] != "count"
                and label_col[0] not in fd.get("groupby")
            ):
                raise Exception(_("Choice of [Label] must be present in [Group By]"))

            if fd.get("point_radius") != "Auto" and fd.get(
                "point_radius"
            ) not in fd.get("groupby"):
                raise Exception(
                    _("Choice of [Point Radius] must be present in [Group By]")
                )

            if fd.get("all_columns_x") not in fd.get("groupby") or fd.get(
                "all_columns_y"
            ) not in fd.get("groupby"):
                raise Exception(
                    _(
                        "[Longitude] and [Latitude] columns must be present in "
                        + "[Group By]"
                    )
                )
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        fd = self.form_data
        label_col = fd.get("mapbox_label")
        has_custom_metric = label_col is not None and len(label_col) > 0
        metric_col = [None] * len(df.index)
        if has_custom_metric:
            if label_col[0] == fd.get("all_columns_x"):  # type: ignore
                metric_col = df[fd.get("all_columns_x")]
            elif label_col[0] == fd.get("all_columns_y"):  # type: ignore
                metric_col = df[fd.get("all_columns_y")]
            else:
                metric_col = df[label_col[0]]  # type: ignore
        point_radius_col = (
            [None] * len(df.index)
            if fd.get("point_radius") == "Auto"
            else df[fd.get("point_radius")]
        )

        # limiting geo precision as long decimal values trigger issues
        # around json-bignumber in Mapbox
        GEO_PRECISION = 10
        # using geoJSON formatting
        geo_json = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"metric": metric, "radius": point_radius},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            round(lon, GEO_PRECISION),
                            round(lat, GEO_PRECISION),
                        ],
                    },
                }
                for lon, lat, metric, point_radius in zip(
                    df[fd.get("all_columns_x")],
                    df[fd.get("all_columns_y")],
                    metric_col,
                    point_radius_col,
                )
            ],
        }

        x_series, y_series = df[fd.get("all_columns_x")], df[fd.get("all_columns_y")]
        south_west = [x_series.min(), y_series.min()]
        north_east = [x_series.max(), y_series.max()]

        return {
            "geoJSON": geo_json,
            "hasCustomMetric": has_custom_metric,
            "mapboxApiKey": config.get("MAPBOX_API_KEY"),
            "mapStyle": fd.get("mapbox_style"),
            "aggregatorName": fd.get("pandas_aggfunc"),
            "clusteringRadius": fd.get("clustering_radius"),
            "pointRadiusUnit": fd.get("point_radius_unit"),
            "globalOpacity": fd.get("global_opacity"),
            "bounds": [south_west, north_east],
            "renderWhileDragging": fd.get("render_while_dragging"),
            "tooltip": fd.get("rich_tooltip"),
            "color": fd.get("mapbox_color"),
        }


class DeckGLMultiLayer(BaseViz):

    """Pile on multiple DeckGL layers"""

    viz_type = "deck_multi"
    verbose_name = _("Deck.gl - Multiple Layers")

    is_timeseries = False
    credits = '<a href="https://uber.github.io/deck.gl/">deck.gl</a>'

    def query_obj(self):
        return None

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        # Late imports to avoid circular import issues
        from superset.models.slice import Slice
        from superset import db

        slice_ids = fd.get("deck_slices")
        slices = db.session.query(Slice).filter(Slice.id.in_(slice_ids)).all()
        return {
            "mapboxApiKey": config.get("MAPBOX_API_KEY"),
            "slices": [slc.data for slc in slices],
        }


class BaseDeckGLViz(BaseViz):

    """Base class for deck.gl visualizations"""

    is_timeseries = False
    credits = '<a href="https://uber.github.io/deck.gl/">deck.gl</a>'
    spatial_control_keys = []

    def get_metrics(self):
        self.metric = self.form_data.get("size")
        return [self.metric] if self.metric else []

    def process_spatial_query_obj(self, key, group_by):
        group_by.extend(self.get_spatial_columns(key))

    def get_spatial_columns(self, key):
        spatial = self.form_data.get(key)
        if spatial is None:
            raise ValueError(_("Bad spatial key"))

        if spatial.get("type") == "latlong":
            return [spatial.get("lonCol"), spatial.get("latCol")]
        elif spatial.get("type") == "delimited":
            return [spatial.get("lonlatCol")]
        elif spatial.get("type") == "geohash":
            return [spatial.get("geohashCol")]

    @staticmethod
    def parse_coordinates(s):
        if not s:
            return None
        try:
            p = Point(s)
            return (p.latitude, p.longitude)  # pylint: disable=no-member
        except Exception:
            raise SpatialException(_("Invalid spatial point encountered: %s" % s))

    @staticmethod
    def reverse_geohash_decode(geohash_code):
        lat, lng = geohash.decode(geohash_code)
        return (lng, lat)

    @staticmethod
    def reverse_latlong(df, key):
        df[key] = [tuple(reversed(o)) for o in df[key] if isinstance(o, (list, tuple))]

    def process_spatial_data_obj(self, key, df):
        spatial = self.form_data.get(key)
        if spatial is None:
            raise ValueError(_("Bad spatial key"))

        if spatial.get("type") == "latlong":
            df[key] = list(
                zip(
                    pd.to_numeric(df[spatial.get("lonCol")], errors="coerce"),
                    pd.to_numeric(df[spatial.get("latCol")], errors="coerce"),
                )
            )
        elif spatial.get("type") == "delimited":
            lon_lat_col = spatial.get("lonlatCol")
            df[key] = df[lon_lat_col].apply(self.parse_coordinates)
            del df[lon_lat_col]
        elif spatial.get("type") == "geohash":
            df[key] = df[spatial.get("geohashCol")].map(self.reverse_geohash_decode)
            del df[spatial.get("geohashCol")]

        if spatial.get("reverseCheckbox"):
            self.reverse_latlong(df, key)

        if df.get(key) is None:
            raise NullValueException(
                _(
                    "Encountered invalid NULL spatial entry, \
                                       please consider filtering those out"
                )
            )
        return df

    def add_null_filters(self):
        fd = self.form_data
        spatial_columns = set()
        for key in self.spatial_control_keys:
            for column in self.get_spatial_columns(key):
                spatial_columns.add(column)

        if fd.get("adhoc_filters") is None:
            fd["adhoc_filters"] = []

        line_column = fd.get("line_column")
        if line_column:
            spatial_columns.add(line_column)

        for column in sorted(spatial_columns):
            filter_ = to_adhoc({"col": column, "op": "IS NOT NULL", "val": ""})
            fd["adhoc_filters"].append(filter_)

    def query_obj(self):
        fd = self.form_data

        # add NULL filters
        if fd.get("filter_nulls", True):
            self.add_null_filters()

        d = super().query_obj()
        gb = []

        for key in self.spatial_control_keys:
            self.process_spatial_query_obj(key, gb)

        if fd.get("dimension"):
            gb += [fd.get("dimension")]

        if fd.get("js_columns"):
            gb += fd.get("js_columns")
        metrics = self.get_metrics()
        gb = list(set(gb))
        if metrics:
            d["groupby"] = gb
            d["metrics"] = metrics
            d["columns"] = []
        else:
            d["columns"] = gb
        return d

    def get_js_columns(self, d):
        cols = self.form_data.get("js_columns") or []
        return {col: d.get(col) for col in cols}

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        # Processing spatial info
        for key in self.spatial_control_keys:
            df = self.process_spatial_data_obj(key, df)

        features = []
        for d in df.to_dict(orient="records"):
            feature = self.get_properties(d)
            extra_props = self.get_js_columns(d)
            if extra_props:
                feature["extraProps"] = extra_props
            features.append(feature)

        return {
            "features": features,
            "mapboxApiKey": config.get("MAPBOX_API_KEY"),
            "metricLabels": self.metric_labels,
        }

    def get_properties(self, d):
        raise NotImplementedError()


class DeckScatterViz(BaseDeckGLViz):

    """deck.gl's ScatterLayer"""

    viz_type = "deck_scatter"
    verbose_name = _("Deck.gl - Scatter plot")
    spatial_control_keys = ["spatial"]
    is_timeseries = True

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = bool(fd.get("time_grain_sqla") or fd.get("granularity"))
        self.point_radius_fixed = fd.get("point_radius_fixed") or {
            "type": "fix",
            "value": 500,
        }
        return super().query_obj()

    def get_metrics(self):
        self.metric = None
        if self.point_radius_fixed.get("type") == "metric":
            self.metric = self.point_radius_fixed.get("value")
            return [self.metric]
        return None

    def get_properties(self, d):
        return {
            "metric": d.get(self.metric_label),
            "radius": self.fixed_value
            if self.fixed_value
            else d.get(self.metric_label),
            "cat_color": d.get(self.dim) if self.dim else None,
            "position": d.get("spatial"),
            DTTM_ALIAS: d.get(DTTM_ALIAS),
        }

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        self.metric_label = utils.get_metric_name(self.metric) if self.metric else None
        self.point_radius_fixed = fd.get("point_radius_fixed")
        self.fixed_value = None
        self.dim = self.form_data.get("dimension")
        if self.point_radius_fixed and self.point_radius_fixed.get("type") != "metric":
            self.fixed_value = self.point_radius_fixed.get("value")
        return super().get_data(df)


class DeckScreengrid(BaseDeckGLViz):

    """deck.gl's ScreenGridLayer"""

    viz_type = "deck_screengrid"
    verbose_name = _("Deck.gl - Screen Grid")
    spatial_control_keys = ["spatial"]
    is_timeseries = True

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = fd.get("time_grain_sqla") or fd.get("granularity")
        return super().query_obj()

    def get_properties(self, d):
        return {
            "position": d.get("spatial"),
            "weight": d.get(self.metric_label) or 1,
            "__timestamp": d.get(DTTM_ALIAS) or d.get("__time"),
        }

    def get_data(self, df: pd.DataFrame) -> VizData:
        self.metric_label = utils.get_metric_name(self.metric)
        return super().get_data(df)


class DeckGrid(BaseDeckGLViz):

    """deck.gl's DeckLayer"""

    viz_type = "deck_grid"
    verbose_name = _("Deck.gl - 3D Grid")
    spatial_control_keys = ["spatial"]

    def get_properties(self, d):
        return {"position": d.get("spatial"), "weight": d.get(self.metric_label) or 1}

    def get_data(self, df: pd.DataFrame) -> VizData:
        self.metric_label = utils.get_metric_name(self.metric)
        return super().get_data(df)


def geohash_to_json(geohash_code):
    p = geohash.bbox(geohash_code)
    return [
        [p.get("w"), p.get("n")],
        [p.get("e"), p.get("n")],
        [p.get("e"), p.get("s")],
        [p.get("w"), p.get("s")],
        [p.get("w"), p.get("n")],
    ]


class DeckPathViz(BaseDeckGLViz):

    """deck.gl's PathLayer"""

    viz_type = "deck_path"
    verbose_name = _("Deck.gl - Paths")
    deck_viz_key = "path"
    is_timeseries = True
    deser_map = {
        "json": json.loads,
        "polyline": polyline.decode,
        "geohash": geohash_to_json,
    }

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = fd.get("time_grain_sqla") or fd.get("granularity")
        d = super().query_obj()
        self.metric = fd.get("metric")
        line_col = fd.get("line_column")
        if d["metrics"]:
            self.has_metrics = True
            d["groupby"].append(line_col)
        else:
            self.has_metrics = False
            d["columns"].append(line_col)
        return d

    def get_properties(self, d):
        fd = self.form_data
        line_type = fd.get("line_type")
        deser = self.deser_map[line_type]
        line_column = fd.get("line_column")
        path = deser(d[line_column])
        if fd.get("reverse_long_lat"):
            path = [(o[1], o[0]) for o in path]
        d[self.deck_viz_key] = path
        if line_type != "geohash":
            del d[line_column]
        d["__timestamp"] = d.get(DTTM_ALIAS) or d.get("__time")
        return d

    def get_data(self, df: pd.DataFrame) -> VizData:
        self.metric_label = utils.get_metric_name(self.metric)
        return super().get_data(df)


class DeckPolygon(DeckPathViz):

    """deck.gl's Polygon Layer"""

    viz_type = "deck_polygon"
    deck_viz_key = "polygon"
    verbose_name = _("Deck.gl - Polygon")

    def query_obj(self):
        fd = self.form_data
        self.elevation = fd.get("point_radius_fixed") or {"type": "fix", "value": 500}
        return super().query_obj()

    def get_metrics(self):
        metrics = [self.form_data.get("metric")]
        if self.elevation.get("type") == "metric":
            metrics.append(self.elevation.get("value"))
        return [metric for metric in metrics if metric]

    def get_properties(self, d):
        super().get_properties(d)
        fd = self.form_data
        elevation = fd["point_radius_fixed"]["value"]
        type_ = fd["point_radius_fixed"]["type"]
        d["elevation"] = (
            d.get(utils.get_metric_name(elevation)) if type_ == "metric" else elevation
        )
        return d


class DeckHex(BaseDeckGLViz):

    """deck.gl's DeckLayer"""

    viz_type = "deck_hex"
    verbose_name = _("Deck.gl - 3D HEX")
    spatial_control_keys = ["spatial"]

    def get_properties(self, d):
        return {"position": d.get("spatial"), "weight": d.get(self.metric_label) or 1}

    def get_data(self, df: pd.DataFrame) -> VizData:
        self.metric_label = utils.get_metric_name(self.metric)
        return super(DeckHex, self).get_data(df)


class DeckGeoJson(BaseDeckGLViz):

    """deck.gl's GeoJSONLayer"""

    viz_type = "deck_geojson"
    verbose_name = _("Deck.gl - GeoJSON")

    def query_obj(self):
        d = super().query_obj()
        d["columns"] += [self.form_data.get("geojson")]
        d["metrics"] = []
        d["groupby"] = []
        return d

    def get_properties(self, d):
        geojson = d.get(self.form_data.get("geojson"))
        return json.loads(geojson)


class DeckArc(BaseDeckGLViz):

    """deck.gl's Arc Layer"""

    viz_type = "deck_arc"
    verbose_name = _("Deck.gl - Arc")
    spatial_control_keys = ["start_spatial", "end_spatial"]
    is_timeseries = True

    def query_obj(self):
        fd = self.form_data
        self.is_timeseries = bool(fd.get("time_grain_sqla") or fd.get("granularity"))
        return super().query_obj()

    def get_properties(self, d):
        dim = self.form_data.get("dimension")
        return {
            "sourcePosition": d.get("start_spatial"),
            "targetPosition": d.get("end_spatial"),
            "cat_color": d.get(dim) if dim else None,
            DTTM_ALIAS: d.get(DTTM_ALIAS),
        }

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        d = super().get_data(df)

        return {
            "features": d["features"],  # type: ignore
            "mapboxApiKey": config["MAPBOX_API_KEY"],
        }


class EventFlowViz(BaseViz):

    """A visualization to explore patterns in event sequences"""

    viz_type = "event_flow"
    verbose_name = _("Event flow")
    credits = 'from <a href="https://github.com/williaster/data-ui">@data-ui</a>'
    is_timeseries = True

    def query_obj(self):
        query = super().query_obj()
        form_data = self.form_data

        event_key = form_data.get("all_columns_x")
        entity_key = form_data.get("entity")
        meta_keys = [
            col
            for col in form_data.get("all_columns")
            if col != event_key and col != entity_key
        ]

        query["columns"] = [event_key, entity_key] + meta_keys

        if form_data["order_by_entity"]:
            query["orderby"] = [(entity_key, True)]

        return query

    def get_data(self, df: pd.DataFrame) -> VizData:
        return df.to_dict(orient="records")


class PairedTTestViz(BaseViz):

    """A table displaying paired t-test values"""

    viz_type = "paired_ttest"
    verbose_name = _("Time Series - Paired t-test")
    sort_series = False
    is_timeseries = True

    def get_data(self, df: pd.DataFrame) -> VizData:
        """
        Transform received data frame into an object of the form:
        {
            'metric1': [
                {
                    groups: ('groupA', ... ),
                    values: [ {x, y}, ... ],
                }, ...
            ], ...
        }
        """

        if df.empty:
            return None

        fd = self.form_data
        groups = fd.get("groupby")
        metrics = self.metric_labels
        df = df.pivot_table(index=DTTM_ALIAS, columns=groups, values=metrics)
        cols = []
        # Be rid of falsey keys
        for col in df.columns:
            if col == "":
                cols.append("N/A")
            elif col is None:
                cols.append("NULL")
            else:
                cols.append(col)
        df.columns = cols
        data: Dict = {}
        series = df.to_dict("series")
        for nameSet in df.columns:
            # If no groups are defined, nameSet will be the metric name
            hasGroup = not isinstance(nameSet, str)
            Y = series[nameSet]
            d = {
                "group": nameSet[1:] if hasGroup else "All",
                "values": [{"x": t, "y": Y[t] if t in Y else None} for t in df.index],
            }
            key = nameSet[0] if hasGroup else nameSet
            if key in data:
                data[key].append(d)
            else:
                data[key] = [d]
        return data


class RoseViz(NVD3TimeSeriesViz):

    viz_type = "rose"
    verbose_name = _("Time Series - Nightingale Rose Chart")
    sort_series = False
    is_timeseries = True

    def get_data(self, df: pd.DataFrame) -> VizData:
        if df.empty:
            return None

        data = super().get_data(df)
        result: Dict = {}
        for datum in data:  # type: ignore
            key = datum["key"]
            for val in datum["values"]:
                timestamp = val["x"].value
                if not result.get(timestamp):
                    result[timestamp] = []
                value = 0 if math.isnan(val["y"]) else val["y"]
                result[timestamp].append(
                    {
                        "key": key,
                        "value": value,
                        "name": ", ".join(key) if isinstance(key, list) else key,
                        "time": val["x"],
                    }
                )
        return result


class PartitionViz(NVD3TimeSeriesViz):

    """
    A hierarchical data visualization with support for time series.
    """

    viz_type = "partition"
    verbose_name = _("Partition Diagram")

    def query_obj(self):
        query_obj = super().query_obj()
        time_op = self.form_data.get("time_series_option", "not_time")
        # Return time series data if the user specifies so
        query_obj["is_timeseries"] = time_op != "not_time"
        return query_obj

    def levels_for(self, time_op, groups, df):
        """
        Compute the partition at each `level` from the dataframe.
        """
        levels = {}
        for i in range(0, len(groups) + 1):
            agg_df = df.groupby(groups[:i]) if i else df
            levels[i] = (
                agg_df.mean()
                if time_op == "agg_mean"
                else agg_df.sum(numeric_only=True)
            )
        return levels

    def levels_for_diff(self, time_op, groups, df):
        # Obtain a unique list of the time grains
        times = list(set(df[DTTM_ALIAS]))
        times.sort()
        until = times[len(times) - 1]
        since = times[0]
        # Function describing how to calculate the difference
        func = {
            "point_diff": [pd.Series.sub, lambda a, b, fill_value: a - b],
            "point_factor": [pd.Series.div, lambda a, b, fill_value: a / float(b)],
            "point_percent": [
                lambda a, b, fill_value=0: a.div(b, fill_value=fill_value) - 1,
                lambda a, b, fill_value: a / float(b) - 1,
            ],
        }[time_op]
        agg_df = df.groupby(DTTM_ALIAS).sum()
        levels = {
            0: pd.Series(
                {
                    m: func[1](agg_df[m][until], agg_df[m][since], 0)
                    for m in agg_df.columns
                }
            )
        }
        for i in range(1, len(groups) + 1):
            agg_df = df.groupby([DTTM_ALIAS] + groups[:i]).sum()
            levels[i] = pd.DataFrame(
                {
                    m: func[0](agg_df[m][until], agg_df[m][since], fill_value=0)
                    for m in agg_df.columns
                }
            )
        return levels

    def levels_for_time(self, groups, df):
        procs = {}
        for i in range(0, len(groups) + 1):
            self.form_data["groupby"] = groups[:i]
            df_drop = df.drop(groups[i:], 1)
            procs[i] = self.process_data(df_drop, aggregate=True)
        self.form_data["groupby"] = groups
        return procs

    def nest_values(self, levels, level=0, metric=None, dims=()):
        """
        Nest values at each level on the back-end with
        access and setting, instead of summing from the bottom.
        """
        if not level:
            return [
                {
                    "name": m,
                    "val": levels[0][m],
                    "children": self.nest_values(levels, 1, m),
                }
                for m in levels[0].index
            ]
        if level == 1:
            return [
                {
                    "name": i,
                    "val": levels[1][metric][i],
                    "children": self.nest_values(levels, 2, metric, (i,)),
                }
                for i in levels[1][metric].index
            ]
        if level >= len(levels):
            return []
        return [
            {
                "name": i,
                "val": levels[level][metric][dims][i],
                "children": self.nest_values(levels, level + 1, metric, dims + (i,)),
            }
            for i in levels[level][metric][dims].index
        ]

    def nest_procs(self, procs, level=-1, dims=(), time=None):
        if level == -1:
            return [
                {"name": m, "children": self.nest_procs(procs, 0, (m,))}
                for m in procs[0].columns
            ]
        if not level:
            return [
                {
                    "name": t,
                    "val": procs[0][dims[0]][t],
                    "children": self.nest_procs(procs, 1, dims, t),
                }
                for t in procs[0].index
            ]
        if level >= len(procs):
            return []
        return [
            {
                "name": i,
                "val": procs[level][dims][i][time],
                "children": self.nest_procs(procs, level + 1, dims + (i,), time),
            }
            for i in procs[level][dims].columns
        ]

    def get_data(self, df: pd.DataFrame) -> VizData:
        fd = self.form_data
        groups = fd.get("groupby", [])
        time_op = fd.get("time_series_option", "not_time")
        if not len(groups):
            raise ValueError("Please choose at least one groupby")
        if time_op == "not_time":
            levels = self.levels_for("agg_sum", groups, df)
        elif time_op in ["agg_sum", "agg_mean"]:
            levels = self.levels_for(time_op, groups, df)
        elif time_op in ["point_diff", "point_factor", "point_percent"]:
            levels = self.levels_for_diff(time_op, groups, df)
        elif time_op == "adv_anal":
            procs = self.levels_for_time(groups, df)
            return self.nest_procs(procs)
        else:
            levels = self.levels_for("agg_sum", [DTTM_ALIAS] + groups, df)
        return self.nest_values(levels)

class PlotlyPredictionViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "plotly_prediction"
    verbose_name = _("Prediction")
    is_timeseries = False

    def get_excel_output(self):
        return [{
            'name': 'Prediction',
            'location': ['data'],
            'get_data': timeseries_prediction_to_dataframe,
        },{
            'name': 'Performance',
            'location': ['data', 'evaluate', 'item_metrics'],
            'get_data': timeseries_performance_to_dataframe
        }, {
            'name': 'Validation',
            'location': ['data'],
            'get_data': timeseries_validation_to_dataframe
        }]

    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        date_time = form_data.get("date_time")
        columns = form_data.get("all_columns")
        periods = form_data.get("prediction_day")
        taskId = form_data.get("taskId")
        # more option
        epochs = form_data.get("epochs")
        num_cells = form_data.get("num_cells")
        num_layers = form_data.get("num_layers")
        dropout_rate = form_data.get("dropout_rate")
        learning_rate = form_data.get("learning_rate")
        num_trials = form_data.get("num_trials")
        filters = form_data.get("adhoc_filters")

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = forecast_task.delay(datasource_id, date_time, columns, int(periods), filters, g.user.get_id(), trials=int(num_trials))
            taskId = task.id

        return {
            "data": [
                [
                    {
                        "name": "",
                        "value": {
                            "data": {
                                "date": [],
                                "value": [],
                            },
                            "prediction": {
                                "date": [],
                                "min": [],
                                "max": [],
                                "median": [],
                            },
                        }
                    }
                ]
            ],
            "status": "PROCESSING",
            "taskId": taskId,
            "evaluate": {
               "item_metrics": {
                  "MAPE": {},
               }
            }
        }


class ClassificationPredictionViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "classification_prediction"
    verbose_name = _("Prediction")
    is_timeseries = False

    def get_excel_output(self):
        sheets = [{
            'name': 'Predictions',
            'location': ['data', 'prediction_table'],
            'get_data': table_to_excel_sheet,
        }, {
            'name': 'Performance',
            'location': ['data', 'evaluate'],
            'get_data': accuracy_to_excel_sheet
        }, {
            'name': 'Confusion Matrix',
            'location': ['data', 'evaluate'],
            'get_data': confusion_matrix_to_excel_sheet
        }, {
            'name': 'Important Features',
            'location': ['data', 'importantFeatures'],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': 'Validations',
            'location': ['data', 'validation_table'],
            'get_data': table_to_excel_sheet
        }]

        return sheets

    def query_obj(self):
        []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        target = form_data.get("prediction")
        columns = form_data.get("all_columns")
        biased_groups = form_data.get("biased_groups")
        debiased_features = form_data.get("debiased_features")
        extra_columns = form_data.get("extra_columns")
        filters = form_data.get("adhoc_filters")
        ratio = form_data.get("ratio")
        taskId = form_data.get("taskId")
        optimization_presets = form_data.get('optimization_presets')
        explain_predictions = form_data.get("explain_predictions")
        cross_validation = form_data.get("cross_validation")
        kfolds = form_data.get("kfolds")
        userId = g.user.get_id()

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            presets = "best_quality" if optimization_presets else "medium_quality_faster_train"
            task = classification_task.delay(
                datasource_id, target, columns, filters, g.user.get_id(),
                biased_groups=biased_groups,
                debiased_features=debiased_features,
                validation_ratio=.2 if ratio is None else ratio/100.,
                extra_columns=extra_columns,
                presets=presets,
                explain_samples=explain_predictions,
                kfolds=1 if not cross_validation or kfolds is None else kfolds)
            taskId = task.id

        return {
            "messenger": "",
            "status": "PROCESSING",
            "taskId": taskId,
            "validations": [],
            "data": {},
        }

class RegressionPredictionViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "regression_prediction"
    verbose_name = _("Prediction")
    is_timeseries = False

    def get_excel_output(self):
        sheets = [{
            'name': 'Predictions',
            'location': ['data', 'prediction_table'],
            'get_data': table_to_excel_sheet,
        }, {
            'name': 'Important Features',
            'location': ['data', 'importantFeatures'],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': 'Validations',
            'location': ['data', 'validation_table'],
            'get_data': table_to_excel_sheet
        }]

        return sheets

    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        nameValue = form_data.get("prediction")
        columns = form_data.get("all_columns")
        biased_groups = form_data.get("biased_groups")
        debiased_features = form_data.get("debiased_features")
        extra_columns = form_data.get("extra_columns")
        filters = form_data.get("adhoc_filters")
        validation_percent = form_data.get("ratio")
        taskId = form_data.get("taskId")
        quantile_mode = form_data.get("quantile_mode")
        quantile_low = form_data.get("regression_quantile_low")
        quantile_high = form_data.get("regression_quantile_high")
        optimization_presets = form_data.get('optimization_presets')
        explain_predictions = form_data.get("explain_predictions")
        cross_validation = form_data.get("cross_validation")
        current_intervention = form_data.get("treatment")
        new_intervention = form_data.get("new_treatment")
        common_causes = form_data.get("common_causes")
        kfolds = form_data.get("kfolds") if cross_validation else 1
        userId = g.user.get_id()

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            presets = "best_quality" if optimization_presets else "medium_quality_faster_train"
            task = regression_task.delay(
                datasource_id, nameValue, columns, filters, g.user.get_id(),
                validation_ratio=validation_percent/100. if validation_percent is not None else 0.,
                prediction_quantile_low=float(quantile_low) if quantile_mode else None,
                prediction_quantile_high=float(quantile_high) if quantile_mode else None,
                biased_groups=biased_groups,
                debiased_features=debiased_features,
                extra_columns=extra_columns,
                presets=presets,
                explain_samples=explain_predictions,
                kfolds=kfolds,
                current_intervention_column=current_intervention,
                new_intervention_column=new_intervention,
                common_causes=common_causes,
            )
            taskId = task.id

        return {
            "fields": [],
            "exdata": [],
            "predictData": [],
            "status": "PROCESSING",
            "taskId": taskId,
            "evaluate": {}
        }


class BayesianRegressionViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "bayesian_regression"
    verbose_name = _("Bayesian Linear Regression")
    is_timeseries = False

    def get_excel_output(self):
        sheets = [{
            'name': 'Predictions',
            'location': ['data', 'prediction_table'],
            'get_data': table_to_excel_sheet,
        }, {
            'name': 'Performance',
            'location': ['data', 'evaluation'],
            'get_data': records_to_excel_sheet,
        }, {
            'name': 'Validations',
            'location': ['data', 'validation_table'],
            'get_data': table_to_excel_sheet
        }]

        return sheets

    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        nameValue = form_data.get("prediction")
        columns = form_data.get("all_columns")
        filters = form_data.get("adhoc_filters")
        ratio = form_data.get("ratio")
        taskId = form_data.get("taskId")
        polynomial_degree = form_data.get("polynomial_degree")
        quantile_low = form_data.get("regression_quantile_low")
        quantile_high = form_data.get("regression_quantile_high")
        trials = form_data.get("num_trials")
        priors: list = form_data.get("priors")
        userId = g.user.get_id()

        priorslist: list = []
        for prior in priors:
            priorslist.append({
                'column': prior['columnName'],
                'control': prior['columnValue'] if prior['columnValue'] != '' else None,
                'degree': prior['polynomialDegree'],
                'value': prior['priorValue']
            })

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = bayesian_regression_task.delay(
                datasource_id,
                nameValue,
                columns,
                filters, g.user.get_id(),
                validation_split=ratio,
                polynomial_degree=int(polynomial_degree),
                prediction_quantile_low=float(quantile_low),
                prediction_quantile_high=float(quantile_high),
                trials=trials,
                priors=priorslist,
            )
            taskId = task.id

        return {
            "status": "PROCESSING",
            "taskId": taskId,
        }


class CausalInferenceViz(BaseViz):
    viz_type = "causal_inference"
    verbose_name = _("Causal Inference")
    is_timeseries = False

    def query_obj(self):
        form_data = self.form_data
        d = super().query_obj()
        d["groupby"] = [form_data.get("outcome")]
        d["row_limit"] = int(form_data.get("row_limit") or config.get("ROW_LIMIT"))

        # get params
        datasource = form_data.get("datasource")
        prediction = form_data.get("outcome")
        taskId = form_data.get("taskId")

        #returrn query object
        return d


    def get_data(self, df):
        df = self.get_df()
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        filters = form_data.get("adhoc_filters")
        outcome = form_data.get("outcome")
        positive_outcome_value = form_data.get("positive_outcome_value")
        treatment = form_data.get("treatment")
        treatment_control = form_data.get("treatment_control")
        effect_modifier = form_data.get("effect_modifier")
        common_causes = form_data.get("common_causes")
        log_treatment = form_data.get("log_treatment")
        log_outcome = form_data.get("log_outcome")
        taskId = form_data.get("taskId")
        userId = g.user.get_id()

        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = causal_inference_task.delay(
                datasource_id, 
                [outcome],
                positive_outcome_value,
                [treatment],
                filters,
                userId,
                effect_modifiers=[effect_modifier] if effect_modifier is not None else [],
                controls={treatment: treatment_control} if treatment_control is not None else None,
                common_causes=common_causes,
                log_treatment=log_treatment,
                log_outcome=log_outcome,
            )
            taskId = task.id

        return {
            "data": {},
            "table": df.to_dict(),
            "status": "PROCESSING",
            "taskId": taskId,
            "evaluate": {}
        }


class PlotlyTsneViz(BaseViz):

    """A data table with rich time-series related columns"""

    viz_type = "plotly_tsne"
    verbose_name = _("Tsne Chart")
    is_timeseries = False

    def get_excel_output(self):
        sheets = [{
            'name': 'Projected',
            'location': ['data'],
            'get_data': tsne_projection_to_dataframe,
        }, {
            'name': 'Clusters',
            'location': ['data'],
            'get_data': tsne_clusters_to_dataframe,
        }]

        return sheets


    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        number_clusters = form_data.get("number_clusters")
        group = form_data.get("group")
        perplexity = form_data.get("perplexity")
        columns = form_data.get("all_columns")
        extra_columns = form_data.get("extra_columns")
        filters = form_data.get("adhoc_filters")
        taskId = form_data.get("taskId")
        max_train_samples = form_data.get("max_train_samples")
        explain_predictions = form_data.get("explain_predictions")
        
        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = clustering_task.delay(
                datasource_id,
                group,
                columns,
                "auto" if number_clusters == "auto" else int(number_clusters),
                filters,
                g.user.get_id(),
                extra_columns=extra_columns,
                max_train_samples=None if max_train_samples is None else int(max_train_samples),
                explain_samples=explain_predictions)
            taskId = task.id

        return {
            "data": [
                {
                    "cluster_id": "",
                    "value": [
                        {
                            "train":{},
                            "column":{},
                        },
                    ],
                }
            ],
            "status": "PROCESSING",
            "taskId": taskId
        }


class CleanDataViz(BaseViz):

    """A basic html table that is sortable and searchable"""

    viz_type = "clean_data"
    verbose_name = _("Clean Data")
    is_timeseries = False

    def get_excel_output(self):
        return [{
            'name': 'Clean Data',
            'location': ['data', 'records'],
            'get_data': cleandata_records_to_excel,
        }]

    def query_obj(self):
        return []

    def get_data(self, df):
        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        rules = form_data.get("rules")

        filters = form_data.get("adhoc_filters")
        show_empty = form_data.get("show_empty")
        taskId = form_data.get("taskId")
        
        if not taskId:
            security_manager.can_create_task()
            m = re.match(r"(\d+)__.+", datasource_id_type)
            datasource_id = m.group(1)
            task = data_imputation_task.delay(datasource_id, rules, filters, g.user.get_id(), show_empty)
            taskId = task.id
        return {
            "data": [
                {
                    "columns": [],
                    "records": [
                        {},
                    ],
                }
            ],
            "status": "PROCESSING",
            "taskId": taskId
        }


class AnovaViz(BaseViz):

    """Visualizatio for Analysis of Variance"""

    viz_type = "anova"
    verbose_name = _("Analysis of Variance")
    is_timeseries = False
    def get_excel_output(self):
        treatments = self.form_data.get('treatment')

        sheets = [{
            'name': 'ANOVA Table',
            'location': ['data', 'anova_summary'],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': f'Tukey\'s Test - {treatments[0]}',
            'location': ['data', 'tukey_summary', treatments[0]],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': 'Barlett',
            'location': ['data', 'bartlett_summary'],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': 'Levene',
            'location': ['data', 'levene_summary'],
            'get_data': legacy_table_to_excel_sheet
        }, {
            'name': 'Shapiro-Wilk',
            'location': ['data', 'shapiro_wilk_summary'],
            'get_data': legacy_table_to_excel_sheet
        }]

        if len(treatments) == 2:
            sheets.insert(2, {
                'name': f'Tukey\'s Test - {treatments[1]}',
                'location': ['data', 'tukey_summary', treatments[1]],
                'get_data': legacy_table_to_excel_sheet,
            })
            sheets.insert(3, {
                'name': f'Tukey\'s Test - Interaction',
                'location': ['data', 'tukey_summary', f'{treatments[0]}_{treatments[1]}'],
                'get_data': legacy_table_to_excel_sheet,
            })

        return sheets

    def query_obj(self):
        return []

    def get_data(self, df):

        from superset import db
        from superset.connectors.sqla.models import SqlaTable
        from superset.filters import data_filters

        form_data = self.form_data
        datasource_id_type = form_data.get("datasource")
        treatments = form_data.get("treatment")
        outcome = form_data.get("outcome")
        filters = form_data.get("adhoc_filters")

        m = re.match(r"(\d+)__.+", datasource_id_type)
        datasource_id = m.group(1)

        datasource = db.session.query(SqlaTable).filter_by(id=datasource_id).one()
        database = datasource.database
        schema = datasource.schema
        df_all = data_filters(datasource.table_name, database, schema, filters, datasource_id=datasource_id)
        columns_all = df_all.columns.tolist()
        if "_tid_" in columns_all:
            columns_all.remove("_tid_")
        df = df_all[columns_all]

        return anova_task(df, treatments, outcome)


viz_types = {
    o.viz_type: o
    for o in globals().values()
    if (
        inspect.isclass(o)
        and issubclass(o, BaseViz)
        and o.viz_type not in config.get("VIZ_TYPE_BLACKLIST")
    )
}

def confusion_matrix_to_excel_sheet(data):
    return pd.DataFrame(data=data['confusion_matrix'], columns=data['labels'], index=data['labels'])

def legacy_table_to_excel_sheet(data):
    if not isinstance(data, list):
        data = [data]

    if len(data) > 0:
        return pd.DataFrame.from_dict(data)
    return None

def table_to_excel_sheet(data):
    if len(data['index']) > 0:
        return pd.DataFrame(data=data['data'], index=data['index'])
    return None

def accuracy_to_excel_sheet(data):
    return pd.DataFrame(data=[[data['accuracy']]], columns=['accuracy'])


def records_to_excel_sheet(data):
    if not isinstance(data, list):
        data = [data]

    if len(data) > 0:
        return pd.DataFrame.from_records(data)
    return None

def tsne_projection_to_dataframe(data):
    return pd.DataFrame.from_records([
        {
            'cluster_id': cluster['cluster_id'],
            'projected_x': row['train']['x'],
            'projected_y': row['train']['y'],
            **row['column']
        }
        for cluster in data
        for row in cluster['value']
    ]).sort_values('cluster_id')

def tsne_clusters_to_dataframe(data):
    return pd.DataFrame.from_records([
        {
            'cluster_id': cluster['cluster_id'],
            'explanation': cluster['explanation']
        }
        for cluster in data
    ]).sort_values('cluster_id')

def cleandata_records_to_excel(data):
    return pd.DataFrame.from_records([
        element["text"]
        for element in data
    ])

def correlation_to_dataframe(data):
    return pd.DataFrame.from_records([
        {
            'column_name': corr['col'][0] if isinstance(corr['col'], list) else corr['col'],
            'column_value': corr['col'][1] if isinstance(corr['col'], list) else '',
            'correlation': corr['corr'], 
            'P value': corr['pval']
        }
        for corr in data
    ]).sort_values('correlation').sort_values('column_name')

def timeseries_performance_to_dataframe(data):
    return pd.DataFrame.from_records([
        {'Metric': metric, **data[metric]}
        for metric in ['MAPE', 'MASE', 'MSE', 'sMAPE']
    ])

def timeseries_validation_to_dataframe(data):
    df = pd.DataFrame()
    dates = data['evaluate']['dates']

    for (column_index, column) in enumerate(data['predict'][0]):
        df[(column['name'], 'Actual')] = data['predict'][0][column_index]['value']['data']['value'][-(len(dates)):]
        df[(column['name'], 'Q5')] = data['evaluate']['values'][0][column_index]['q5']
        df[(column['name'], 'Q50')] = data['evaluate']['values'][0][column_index]['q50']
        df[(column['name'], 'Q95')] = data['evaluate']['values'][0][column_index]['q95']

    df.index = dates
    df.index.name = 'Dates'
    df.columns = pd.MultiIndex.from_tuples(df.columns)

    return df

def timeseries_prediction_to_dataframe(data):
    df = pd.DataFrame()
    dates = data['predict'][0][0]['value']['prediction']['date']

    for column in data['predict'][0]:
        df[(column['name'], 'MAX')] = column['value']['prediction']['max']
        df[(column['name'], 'MEDIAN')] = column['value']['prediction']['median']
        df[(column['name'], 'MIN')] = column['value']['prediction']['min']

    df.index = dates
    df.index.name = 'Dates'
    df.columns = pd.MultiIndex.from_tuples(df.columns)

    return df
