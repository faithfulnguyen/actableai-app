import requests
from flask import (
    request,
    Response
)
from flask_appbuilder import expose

from superset import (
    appbuilder,
    conf,
    security_manager
)
from werkzeug.exceptions import BadRequest
from superset.exceptions import (
    SupersetSecurityException,
)
from .base import (
    api,
    BaseSupersetView,
    handle_api_exception,
)


class NluAPI(BaseSupersetView):

    """Proxy all requests to nlu"""

    route_base = "/nlu-api"

    @api
    @handle_api_exception
    @expose("/<path:any_path>", methods=["GET", "POST", "PUT", "DELETE"])
    def proxy(self, any_path):
        if not security_manager.has_access("workflow_access", "workflow_access"):
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.MISSING_WORKFLOW_ACCESS_ERROR,
                    message="user does not have workflow_access permission",
                    level=ErrorLevel.ERROR,
                )
            )
            
        if request.method == "GET":
            method = requests.get
        elif request.method == "PUT":
            method = requests.put
        elif request.method == "DELETE":
            method = requests.delete
        else:
            method = requests.post
        headers = {k: v for k, v in request.headers.items()}
        headers.pop('Content-Type', None)
        req = dict()
        if request.method != "GET":
            try:
                json_dict = request.json
            except BadRequest:
                json_dict = dict()
            if json_dict is not None:
                req["json"] = json_dict
            else:
                if request.form is not None:
                    req["data"] = request.form.to_dict()
                if request.files is not None:
                    req["files"] = request.files.to_dict()
        r = method(conf.get(
            "NLU_HOST") + request.full_path,
            headers=headers,
            **req)
        r.headers.pop('Content-Encoding', None)
        r.headers.pop('Content-Length', None)

        res = Response(
            r.text,
            status=r.status_code,
            headers=r.headers.items())
        return res


appbuilder.add_view_no_menu(NluAPI, endpoint='nlu-api')
