import hashlib
import json
import os
from flask import request, make_response
from cryptography.fernet import Fernet, InvalidToken


def content_hash(*parts: str) -> str:
    """
    Stable SHA-256 hash for any number of string parts.
    """
    h = hashlib.sha256()
    for p in parts:
        h.update((p or "").encode("utf-8"))
    return h.hexdigest()


def json_response(payload: str, status: int = 200, etag_value: str | None = None):
    """
    Return a raw JSON payload string (already serialized) with optional ETag.
    NOTE: meetings_routes passes a JSON string (via json.dumps).
    """
    resp = make_response(payload, status)
    resp.headers["Content-Type"] = "application/json"
    if etag_value:
        resp.headers["ETag"] = etag_value
        resp.headers["Cache-Control"] = "private, max-age=60"
    return resp


def check_if_none_match(etag_value: str) -> bool:
    """
    Return True if the client's If-None-Match matches ETag (so I can 304).
    """
    client_etag = request.headers.get("If-None-Match")
    return client_etag == etag_value

# Encrypt/Decrypt Helpers
# Will be used for OAuth


def _fernet():
    key = os.getenv("FERNET_KEY")
    if not key:
        # one-time: generate with Fernet.generate_key().decode() and put into .env
        raise RuntimeError("FERNET_KEY missing")
    return Fernet(key.encode())


def encrypt_bytes(raw: bytes) -> bytes:
    return _fernet().encrypt(raw)


def decrypt_bytes(tok: bytes) -> bytes:
    return _fernet().decrypt(tok)
