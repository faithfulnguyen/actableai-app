from superset import app
from requests.exceptions import ConnectionError
from flask import g, session
import requests


def get_token_auth():
    return requests.get(
        app.config.get("FULFILLMENT_HOST") + "/token",
        headers={"userEmail": g.user.email, "userDomain": app.config.get("SUPERSET_DOMAIN")})


def get_api_key():
    return requests.get(
        app.config.get("FULFILLMENT_HOST") + "/api/v1/get-api-key",
        headers={"Authorization": session["fulfillment_token"]})


def get_ontology():
    return requests.get(
        app.config.get("FULFILLMENT_HOST") + "/ontology-header",
        headers={"Authorization": session["fulfillment_token"]})


def get_status_train():
    return requests.get(
        app.config.get("FULFILLMENT_HOST") + "/get-training-status",
        headers={"Content-Type": "application/json",
                 "Authorization": session["fulfillment_token"]})


def train_mapping():
    return requests.post(
        app.config.get("FULFILLMENT_HOST") + "/train",
        headers={"Content-Type": "application/json",
                 "Authorization": session["fulfillment_token"]})


def get_list_entity():
    try:
        if "fulfillment_token" not in session:
            r = get_token_auth()
            if r.status_code != 200:
                return []

            data = r.json()
            session["fulfillment_token"] = data["data"]["token"]

        resp = get_ontology()

        if resp.status_code != 200:
            r = get_token_auth()
            if r.status_code != 200:
                return []
            data = r.json()
            session["fulfillment_token"] = data["data"]["token"]

            resp = get_ontology()

        data = resp.json()

        return data["data"]
    except (KeyError, ConnectionError):
        return []


def get_status_train_before():
    try:
        r = get_token_auth()
        if r.status_code != 200:
            return "NOT_FOUND"
        data = r.json()
        session["fulfillment_token"] = data["data"]["token"]

        resp = get_status_train()
        if resp.status_code != 200:
            return "NOT_FOUND"
        result = resp.json()
        return result["data"]["status"]
    except (KeyError, ConnectionError):
        return "NOT_FOUND"


def get_status_train_process():
    try:
        resp = get_status_train()
        if resp.status_code != 200:
            return "ERROR"
        result = resp.json()
        return result["data"]["status"]
    except (KeyError, ConnectionError):
        return "ERROR"
