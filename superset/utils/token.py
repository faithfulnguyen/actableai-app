from superset import app
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer


def get_token(id, expiration=600):
    s = Serializer(app.config.get("SECRET_KEY"), expiration)
    return s.dumps({"id": id}).decode("utf-8")


def verify_token(token):
    s = Serializer(app.config.get("SECRET_KEY"))
    try:
        if token is None:
            return None
        data = s.loads(token)
    except Exception:
        return None

    id = data.get("id")
    if id:
        return id
    return None
