from datetime import date
from flask import Blueprint, request, jsonify, session
from models import db, ActionItem, Meeting

bp_items = Blueprint("action_items", __name__, url_prefix="")


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return uid, None


@bp_items.get("/meetings/<int:mid>/action-items")
def list_items(mid):
    uid, err = _require_auth()
    if err:
        return err
    meeting = Meeting.query.get_or_404(mid)
    if meeting.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    items = [a.to_dict() for a in meeting.action_items]
    return jsonify(items), 200


@bp_items.post("/meetings/<int:mid>/action-items")
def create_item(mid):
    uid, err = _require_auth()
    if err:
        return err
    meeting = Meeting.query.get_or_404(mid)
    if meeting.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json() or {}
    item = ActionItem(
        meeting_id=mid,
        description=data.get("description", "").strip(),
        priority=data.get("priority", "medium"),
        status=data.get("status", "open"),
    )
    if not item.description:
        return jsonify({"error": "description required"}), 400
    if data.get("assignee_id"):
        item.assignee_id = data["assignee_id"]
    if data.get("due_date"):
        item.due_date = date.fromisoformat(data["due_date"])
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@bp_items.patch("/action-items/<int:item_id>")
def update_item(item_id):
    uid, err = _require_auth()
    if err:
        return err
    item = ActionItem.query.get_or_404(item_id)
    meeting = Meeting.query.get(item.meeting_id)
    if meeting.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json() or {}
    if "description" in data:
        item.description = data["description"].strip()
    if "priority" in data:
        item.priority = data["priority"]
    if "status" in data:
        item.status = data["status"]
    if "assignee_id" in data:
        item.assignee_id = data["assignee_id"]
    if "due_date" in data:
        item.due_date = (date.fromisoformat(
            data["due_date"]) if data["due_date"] else None)
    db.session.commit()
    return jsonify(item.to_dict()), 200


@bp_items.delete("/action-items/<int:item_id>")
def delete_item(item_id):
    uid, err = _require_auth()
    if err:
        return err
    item = ActionItem.query.get_or_404(item_id)
    meeting = Meeting.query.get(item.meeting_id)
    if meeting.creator_id != uid:
        return jsonify({"error": "forbidden"}), 403
    db.session.delete(item)
    db.session.commit()
    return "", 204
