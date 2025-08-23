import json
from os import getenv
from flask import Blueprint, request, jsonify, session
from models import db, Meeting, Summary
from utils import content_hash, json_response, check_if_none_match
from summarizer import summarize_notes

bp_meetings = Blueprint("meetings", __name__, url_prefix="/meetings")


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return uid, None


@bp_meetings.get("")
def list_meetings():
    uid, err = _require_auth()
    if err:
        return err
    q = (
        Meeting.query.filter_by(creator_id=uid)
        .order_by(Meeting.meeting_date.asc().nullslast())
    )
    return jsonify([m.to_dict() for m in q.all()]), 200


@bp_meetings.post("")
def create_meeting():
    uid, err = _require_auth()
    if err:
        return err
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    m = Meeting(
        creator_id=uid,
        title=title,
        raw_notes=data.get("raw_notes"),
    )
    # Accept ISO datetime string for meeting_date if provided
    if data.get("meeting_date"):
        from datetime import datetime
        m.meeting_date = datetime.fromisoformat(data["meeting_date"])
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@bp_meetings.get("/<int:mid>")
def get_meeting(mid):
    uid, err = _require_auth()
    if err:
        return err
    m = Meeting.query.get_or_404(mid)
    if m.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    return jsonify(m.to_dict(include_children=True)), 200


@bp_meetings.patch("/<int:mid>")
def update_meeting(mid):
    uid, err = _require_auth()
    if err:
        return err
    m = Meeting.query.get_or_404(mid)
    if m.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json() or {}
    if "title" in data:
        m.title = data["title"].strip()
    if "raw_notes" in data:
        m.raw_notes = data["raw_notes"]
    if "meeting_date" in data:
        from datetime import datetime
        m.meeting_date = (
            datetime.fromisoformat(
                data["meeting_date"]) if data["meeting_date"] else None
        )
    db.session.commit()
    return jsonify(m.to_dict()), 200


@bp_meetings.delete("/<int:mid>")
def delete_meeting(mid):
    uid, err = _require_auth()
    if err:
        return err
    m = Meeting.query.get_or_404(mid)
    if m.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    db.session.delete(m)
    db.session.commit()
    return "", 204


# ---- Summarize (POST) ----
@bp_meetings.post("/<int:mid>/summarize")
def summarize(mid):
    uid, err = _require_auth()
    if err:
        return err
    m = Meeting.query.get_or_404(mid)
    if m.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403

    if not (m.raw_notes and m.title):
        return jsonify({"error": "meeting must have title and raw_notes to summarize"}), 400

    # Include prompt version in the content hash so changing the prompt forces regeneration
    prompt_version = getenv("PROMPT_VERSION", "v1")
    h = content_hash(m.title, m.raw_notes, prompt_version)

    # Short-circuit if latest summary already matches this content hash
    latest = (
        Summary.query.filter_by(meeting_id=mid)
        .order_by(Summary.created_at.desc())
        .first()
    )
    if latest:
        try:
            meta = json.loads(latest.model_metadata or "{}")
        except Exception:
            meta = {}
        if meta.get("content_hash") == h:
            etag = content_hash(
                str(latest.id),
                latest.updated_at.isoformat() if latest.updated_at else "",
            )
            if check_if_none_match(etag):
                return "", 304
            return json_response(json.dumps(latest.to_dict()), etag_value=etag)

    # Generate a fresh summary (OpenAI if configured, else stub)
    result, meta = summarize_notes(m.title, m.raw_notes)

    s = Summary(
        meeting_id=mid,
        bullets_json=json.dumps(result.get("summary_bullets", [])),
        decisions_json=json.dumps(result.get("decisions", [])),
        model_metadata=json.dumps({**meta, "content_hash": h}),
    )
    db.session.add(s)
    db.session.commit()

    etag = content_hash(str(s.id), s.updated_at.isoformat()
                        if s.updated_at else "")
    return json_response(json.dumps(s.to_dict()), status=201, etag_value=etag)


# ---- Read latest summary (GET) ----
@bp_meetings.get("/<int:mid>/summary")
def get_latest_summary(mid):
    uid, err = _require_auth()
    if err:
        return err
    m = Meeting.query.get_or_404(mid)
    if m.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403

    s = (
        Summary.query.filter_by(meeting_id=mid)
        .order_by(Summary.created_at.desc())
        .first()
    )
    if not s:
        return jsonify({"error": "no summary"}), 404

    etag = content_hash(str(s.id), s.updated_at.isoformat()
                        if s.updated_at else "")
    if check_if_none_match(etag):
        return "", 304
    return json_response(json.dumps(s.to_dict()), etag_value=etag)
