import os
import bcrypt
from flask import Blueprint, request, session, jsonify
from models import db, User

bp_auth = Blueprint("auth", __name__, url_prefix="/auth")


def _hash_password(pw: str) -> bytes:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12))


def _check_password(pw: str, hashed: bytes) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed)
    except Exception:
        return False


@bp_auth.post("/signup")
def signup():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""
    if not email or not name or not password:
        return jsonify({"error": "email, name, and password are required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already in use"}), 409
    user = User(email=email, name=name, password_hash=_hash_password(password))
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return jsonify(user.to_dict()), 201


@bp_auth.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not _check_password(password, user.password_hash):
        return jsonify({"error": "invalid credentials"}), 401
    session["user_id"] = user.id
    return jsonify(user.to_dict()), 200


@bp_auth.delete("/logout")
def logout():
    session.clear()
    return "", 204


@bp_auth.get("/me")
def me():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"error": "unauthorized"}), 401
    user = User.query.get(uid)
    return jsonify(user.to_dict()), 200
