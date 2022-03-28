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
"""Loads datasets, dashboards and slices in a new superset instance"""
import os

import pandas as pd
from sqlalchemy import DateTime, String
from sqlalchemy.sql import column

from superset import db
from superset.connectors.sqla.models import SqlMetric
from superset.models.slice import Slice
from superset.utils import core as utils

from ..helpers import (
    EXAMPLES_FOLDER,
    get_example_data,
    get_slice_json,
    merge_slice,
    TBL,
)


def load_world_health_population_by_year(
    only_metadata=False, force=False
):  # pylint: disable=too-many-locals
    """Loads the world bank health dataset and slices"""
    tbl_name = "wb_health_population"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("countries.json.gz")
        pdf = pd.read_json(data)
        pdf.columns = [col.replace(".", "_") for col in pdf.columns]
        pdf.year = pd.to_datetime(pdf.year)
        pdf.to_sql(
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=50,
            dtype={
                "year": DateTime(),
                "country_code": String(3),
                "country_name": String(255),
                "region": String(255),
            },
            index=False,
        )

    print("Creating table [wb_health_population] reference")
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = utils.readfile(os.path.join(EXAMPLES_FOLDER, "countries.md"))
    tbl.main_dttm_col = "year"
    tbl.database = database
    tbl.filter_select_enabled = True

    metrics = [
        "sum__SP_POP_TOTL",
        "sum__SH_DYN_AIDS",
        "sum__SH_DYN_AIDS",
        "sum__SP_RUR_TOTL_ZS",
        "sum__SP_DYN_LE00_IN",
        "sum__SP_RUR_TOTL",
    ]
    for metric in metrics:
        if not any(col.metric_name == metric for col in tbl.metrics):
            aggr_func = metric[:3]
            col = str(column(metric[5:]).compile(db.engine))
            tbl.metrics.append(
                SqlMetric(metric_name=metric, expression=f"{aggr_func}({col})")
            )

    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    defaults = {
        "adhoc_filters": [],
        "bottom_margin": "auto",
        "color_scheme": "bnbColors",
        "datasource": "1__table",
        "duration": "1000",
        "granularity_sqla": "year",
        "group": "region",
        "label_colors": {},
        "left_margin": "auto",
        "max_bubble_size": "50",
        "show_legend": True,
        "size": {
            "aggregate": "SUM",
            "column": {
                "column_name": "SP_POP_TOTL",
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "id": 309,
                "is_dttm": False,
                "optionName": "_col_SP_POP_TOTL",
                "type": "DOUBLE PRECISION",
                "verbose_name": None
            },
            "expressionType": "SIMPLE",
            "fromFormData": False,
            "hasCustomLabel": False,
            "label": "SUM(SP_POP_TOTL)",
            "optionName": "metric_oy2q257vxrf_4zqdnl8z8le",
            "sqlExpression": None
        },
        "taskId": None,
        "time_range": "No filter",
        "timeline": "year",
        "url_params": {},
        "viz_type": "plotly_bubble",
        "x": {
            "aggregate": "SUM",
            "column": {
                "column_name": "SP_RUR_TOTL_ZS",
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "id": 320,
                "is_dttm": False,
                "optionName": "_col_SP_RUR_TOTL_ZS",
                "type": "DOUBLE PRECISION",
                "verbose_name": None
            },
            "expressionType": "SIMPLE",
            "fromFormData": False,
            "hasCustomLabel": False,
            "label": "SUM(SP_RUR_TOTL_ZS)",
            "optionName": "metric_e2fsxljdt3_vmuqvyfgrhp",
            "sqlExpression": None
        },
        "x_axis_format": "SMART_NUMBER",
        "x_axis_label": "",
        "y": {
            "aggregate": "SUM",
            "column": {
                "column_name": "SP_DYN_LE00_IN",
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "id": 162,
                "is_dttm": False,
                "optionName": "_col_SP_DYN_LE00_IN",
                "type": "DOUBLE PRECISION",
                "verbose_name": None
            },
            "expressionType": "SIMPLE",
            "fromFormData": False,
            "hasCustomLabel": False,
            "label": "SUM(SP_DYN_LE00_IN)",
            "optionName": "metric_3qi9xqxmao_8ry4kzyb46h",
            "sqlExpression": None
        },
        "y_axis_format": "SMART_NUMBER",
        "y_axis_label": ""
    }

    print("Creating slice")
    slices = Slice(
        slice_name="World health population by year",
        viz_type="plotly_bubble",
        datasource_type="table",
        datasource_name=tbl_name,
        datasource_id=tbl.id,
        params=get_slice_json(defaults),
    )
    merge_slice(slices)
