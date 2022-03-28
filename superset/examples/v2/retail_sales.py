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
import pandas as pd
from sqlalchemy import BigInteger, Date

from superset import db
from superset.models.slice import Slice
from superset.utils import core as utils

from ..helpers import (
    get_slice_json,
    merge_slice,
    TBL,
    get_path_by_filename
)


def load_retail_sales_data(only_metadata=False, force=False):
    """Loading data for map with retail sales"""
    tbl_name = "number_retail_sales"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        filepath = get_path_by_filename(tbl_name)
        data = pd.read_csv(filepath, encoding="utf-8")
        data.to_sql(  # pylint: disable=no-member
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            dtype={
                "date": Date(),
                "numer_retail_sales": BigInteger
            },
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    print("Creating table reference")
    obj = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = TBL(table_name=tbl_name)
    obj.main_dttm_col = "date"
    obj.database = database
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()

    defaults = {
        "bottom_margin": "auto",
        "color_scheme": "bnbColors",
        "datasource": "{}__table".format(obj.id),
        "date_time": "date",
        "label_colors": {},
        "left_margin": "auto",
        "prediction": "numer_retail_sales",
        "prediction_day": "50",
        "show_legend": True,
        "taskId": None,
        "url_params": {},
        "viz_type": "plotly_prediction",
        "x_axis_label": "",
        "y_axis_label": ""
    }

    print("Creating slice")
    slices = Slice(
        slice_name="Time series of retail sales",
        viz_type="plotly_prediction",
        datasource_type="table",
        datasource_name=tbl_name,
        datasource_id=obj.id,
        params=get_slice_json(defaults),
    )
    merge_slice(slices)
