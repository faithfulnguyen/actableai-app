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

import ray
import ray.util.client
import logging
import simplejson
import numpy as np
import pandas as pd
import six
from datetime import date, datetime
from flask_babel import speaklater
import hubspot
from hubspot.crm.contacts import SimplePublicObjectInput, ApiException
import os


def connect_to_ray():
    import os
    ray.util.client.ray.disconnect()
    try:
        ray.init(os.getenv("RAY_CLIENT"), namespace="aai")
    except RuntimeError as err:
        if "Ray Client is already connected" not in str(err):
            raise
                    

def print_type(map, indent=""):
    print(indent + "{")
    for k, v in map.items():
        if type(v) is dict:
            print_type(v, indent=indent + "  ")
        else:
            print(indent + "  " + str(k) + ": " + str(type(v)))
    print(indent + "}")


class CustomJSONEncoder(simplejson.JSONEncoder):

    def __init__(self, *args, **kwargs):
        super(CustomJSONEncoder, self).__init__(*args, **kwargs)
        self.ignore_nan = True

    def default(self, o):
        self.ignore_nan = True
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if isinstance(o, pd.DataFrame):
            return {
                "columns": o.columns.to_list(),
                "data": o.to_dict(orient="list"),
                "index": o.index.to_series().to_list(),
            }
        if isinstance(o, pd.Series):
            return o.to_list()
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, speaklater.LazyString):
            return six.text_type(o)
        return super(CustomJSONEncoder, self).default(o)

def aai_dumps(obj):
    return simplejson.dumps(obj, cls=CustomJSONEncoder)

def aai_loads(obj):
    return simplejson.loads(obj)

def hubspot_registration(user, route:str='/oauth/google'):
    client = hubspot.Client.create(api_key=os.environ.get('HUBSPOT_API_KEY'))
    properties = {
        "company" : "",
        "email" : user.email,
        "firstname" : user.first_name,
        "lastname" : user.last_name,
        "phone" : "",
        "website" : os.environ.get('ACTABLEAI_URL', default='') + route
    }
    simple_public_object_input = SimplePublicObjectInput(properties=properties)
    try:
        client.crm.contacts.basic_api.create(simple_public_object_input=simple_public_object_input)
    except ApiException as e:
        hubspotlogger = logging.getLogger('HubSpot')
        hubspotlogger.error("Exception when calling basic_api->create: %s\n" % e)
