import simplejson as json
import pandas as pd

from superset import app
from superset.extensions import celery_app
from ludwig.api import LudwigModel
import numpy as np


def classification_ludwig(pd_table, nameValue):
    # DROP null predicted value
    pd_table_train = pd_table[pd.notnull(pd_table[nameValue])]
    pd_table_test = pd_table[pd.isnull(pd_table[nameValue])]

    # Train code
    # Get type column
    new_columns = list(pd_table_train.columns)
    dtypes = []
    for c in new_columns:
        dtypes.append(pd_table_train[c].dtype)
    dtypes2 = []
    for d in dtypes:
        if d in ('int64', 'float64'):
            dtypes2.append('numerical')
        if d == object:
            dtypes2.append('category')
        if d == bool:
            dtypes2.append('binary')
        if d == np.dtype('datetime64[ns]'):
            dtypes2.append('date')

    input_features = []
    for col, dtype in zip(new_columns, dtypes2):
        if dtype == 'date':
            pd_table_train = pd_table_train.drop(columns=[col])
        else:
            input_features.append(dict(name=col, type=dtype))
    for index, item in enumerate(input_features):
        if item['name'] == nameValue:
            typePredict = input_features.pop(index)['type']
    model_definition = {
        'input_features': input_features,
        'output_features': [
            {'name': nameValue, 'type': 'category'}
        ]
    }
    model = LudwigModel(model_definition)
    model.train(data_df=pd_table_train,
                output_directory=app.config["MINDSDB_STORAGE_PATH"])

    # Prediction
    return model.predict(pd_table_test)