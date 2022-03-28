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
from sqlalchemy import BigInteger, Text, Float

from superset import db
from superset.utils import core as utils

from ..helpers import (
    TBL,
    get_path_by_filename
)


def load_invidiual_data(only_metadata=False, force=False):
    """Loading data for map with invidiual"""
    tbl_name = "invidiual"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        filepath = get_path_by_filename(tbl_name)
        data = pd.read_csv(filepath, encoding="utf-8")
        data.to_sql(  # pylint: disable=no-member
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=50,
            dtype={
                "UniqueIdentifier": BigInteger,
                "Department": Text,
                "WorkingStructure": Text,
                "Age": BigInteger,
                "DISC": Text,
                "DISCFirstLetter": Text,
                "DISCFirst2Letters": Text,
                "Nationality": Text,
                "OrganizationalUnit": Text,
                "Gender": Text,
                "HolidayUsed": BigInteger,
                "DevelopmentHours": BigInteger,
                "Year": BigInteger,
                "Level": BigInteger,
                "Performance": BigInteger,
                "FTE": Float,
                "TargetAchievementPortfolio": BigInteger,
                "LeadershipBehaviorPortfolio": BigInteger,
                "Salary": BigInteger,
                "LengthOfService": Float,
                "TargetAchievement": BigInteger,
                "LeadershipBehavior": BigInteger,
                "Title": Text,
                "AbbrOfPosition": Text
            },
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    print("Creating table reference")
    obj = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = TBL(table_name=tbl_name)
    obj.database = database
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
