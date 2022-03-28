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
import abc
import logging
from logging.handlers import TimedRotatingFileHandler

import flask.config
import json_log_formatter
import warnings

class JSONFormatterWithExtraInfo(json_log_formatter.JSONFormatter):
    # Override JSONFormatter with log all detail info
    def extra_from_record(self, record):
        return {
            attr_name: record.__dict__[attr_name]
            for attr_name in record.__dict__
        }


def addJsonFormatHandler(inputLogger):
    json_formatter = JSONFormatterWithExtraInfo()
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(json_formatter)
    inputLogger.addHandler(stream_handler)
    inputLogger.propagate = False


# setup default log format
logger = logging.getLogger(__name__)

# pylint: disable=too-few-public-methods
class LoggingConfigurator(abc.ABC):
    @abc.abstractmethod
    def configure_logging(
            self, app_config: flask.config.Config, debug_mode: bool
    ) -> None:
        pass


class DefaultLoggingConfigurator(LoggingConfigurator):
    def configure_logging(
            self, app_config: flask.config.Config, debug_mode: bool
    ) -> None:
        if app_config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        superset_logger = logging.getLogger("superset")
        if debug_mode:
            superset_logger.setLevel(logging.DEBUG)
        else:
            addJsonFormatHandler(logging.getLogger())
            addJsonFormatHandler(logging.getLogger("superset"))
            addJsonFormatHandler(logging.getLogger("werkzeug"))
            addJsonFormatHandler(logging.getLogger("flask_appbuilder"))
            addJsonFormatHandler(logging.getLogger("flask"))
            addJsonFormatHandler(logging.getLogger("pyhive.presto"))
            addJsonFormatHandler(logging.getLogger("celery"))
            addJsonFormatHandler(logging.getLogger("kombu"))
            addJsonFormatHandler(logging.getLogger("ray"))
            addJsonFormatHandler(logging.getLogger("flask_wtf"))
            addJsonFormatHandler(logging.getLogger("parsedatetime"))
            addJsonFormatHandler(logging.getLogger("wtforms"))
            addJsonFormatHandler(logging.getLogger("flask_oauthlib"))
            addJsonFormatHandler(logging.getLogger("stripe"))
            addJsonFormatHandler(logging.getLogger("flask_caching"))
            addJsonFormatHandler(logging.getLogger("typing"))
            
            warnings.simplefilter("ignore")
            superset_logger.setLevel(logging.INFO)

        logging.getLogger("pyhive.presto").setLevel(logging.INFO)

        logging.basicConfig(format=app_config["LOG_FORMAT"])
        logging.getLogger().setLevel(app_config["LOG_LEVEL"])

        if app_config["ENABLE_TIME_ROTATE"]:
            logging.getLogger().setLevel(app_config["TIME_ROTATE_LOG_LEVEL"])
            handler = TimedRotatingFileHandler(  # type: ignore
                app_config["FILENAME"],
                when=app_config["ROLLOVER"],
                interval=app_config["INTERVAL"],
                backupCount=app_config["BACKUP_COUNT"],
            )
            logging.getLogger().addHandler(handler)

        logger.info("logging was configured successfully")
