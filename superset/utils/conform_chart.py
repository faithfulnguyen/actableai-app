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
import re

from superset import db
from superset.connectors.sqla.models import TableColumn


def handle_datasources(datasources):
    datasource_ids = [d.id for d in datasources]
    columns = db.session.query(TableColumn).filter(
        TableColumn.table_id.in_(datasource_ids)).all()
    time_re = ["date.*", "time.*"]
    number_re = [".*int.*", "num.*", "double.*"]
    str_re = [".*char.*", "string.*", ".*text.*"]
    time_combined = "(" + ")|(".join(time_re) + ")"
    num_combined = "(" + ")|(".join(number_re) + ")"
    str_combined = "(" + ")|(".join(str_re) + ")"
    datasource_list = []
    for datasource in datasources:
        datasource_columns = filter(
            lambda x: x.table_id == datasource.id, columns)
        datasource_types = [d.type for d in datasource_columns]
        conform_chart = ["pivot_table", "word_cloud", "table", "histogram",
                         "plotly_bar",
                         "plotly_tsne",
                         "big_number_total", "pie", "line_multi", "filter_box", "box_plot"]
        time_count = 0
        num_count = 0
        str_count = 0
        if len(datasource_types) >= 2:
            conform_chart.append("plotly_correlation")
        if len(datasource_types) >= 3:
            conform_chart.append("plotly_bubble")
        for datasource_type in datasource_types:
            if datasource_type is not None:
                if re.match(time_combined, datasource_type, re.IGNORECASE):
                    time_count += 1
                if re.match(num_combined, datasource_type, re.IGNORECASE):
                    num_count += 1
                if re.match(str_combined, datasource_type, re.IGNORECASE):
                    str_count += 1
            if time_count >= 1 and num_count >= 1 and str_count >= 1:
                break
        if time_count >= 1:
            conform_chart.extend(["paired_ttest", "line"])
        if num_count >= 1:
            conform_chart.append("regression_prediction")
            conform_chart.append("bayesian_regression")
            conform_chart.append("causal_inference")
        if str_count >= 1:
            conform_chart.append("classification_prediction")
            conform_chart.append("causal_inference")
            conform_chart.append("sentiment_analysis")
        if time_count >= 1 and num_count >= 1:
            conform_chart.append("plotly_prediction")
        # add clean data
        conform_chart.append("clean_data")
        conform_chart.append("anova")
        datasource_list.append({
            "value": str(datasource.id) + "__" + datasource.type,
            "label": repr(datasource),
            "conform_chart": conform_chart
        })
    return datasource_list
