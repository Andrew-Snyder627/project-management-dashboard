from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# ---- User ----


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.LargeBinary, nullable=False)  # bcrypt hash
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    meetings = db.relationship("Meeting", backref="creator", lazy=True)

    def to_dict(self):
        return {"id": self.id, "email": self.email, "name": self.name}

# ---- Meeting ----


class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    creator_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=False)

    # Google Calendar event id (Step 3)
    external_event_id = db.Column(db.String(255), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    meeting_date = db.Column(db.DateTime, nullable=True)
    # store a JSON string of attendees
    attendees_json = db.Column(db.Text, nullable=True)
    raw_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    summaries = db.relationship(
        "Summary", backref="meeting", lazy=True, cascade="all, delete-orphan")
    action_items = db.relationship(
        "ActionItem", backref="meeting", lazy=True, cascade="all, delete-orphan")

    def to_dict(self, include_children=False):
        data = {
            "id": self.id,
            "creator_id": self.creator_id,
            "title": self.title,
            "meeting_date": self.meeting_date.isoformat() if self.meeting_date else None,
            "attendees_json": self.attendees_json,
            "raw_notes": self.raw_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            data["summaries"] = [s.to_dict() for s in self.summaries]
            data["action_items"] = [a.to_dict() for a in self.action_items]
        return data

# ---- Summary ----


class Summary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey(
        "meeting.id"), nullable=False)

    bullets_json = db.Column(db.Text, nullable=True)     # JSON array string
    decisions_json = db.Column(db.Text, nullable=True)   # JSON array string
    # JSON of provider/model/tokens/prompt version
    model_metadata = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "bullets_json": self.bullets_json,
            "decisions_json": self.decisions_json,
            "model_metadata": self.model_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# ---- ActionItem ----


class ActionItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey(
        "meeting.id"), nullable=False)

    assignee_id = db.Column(db.Integer, db.ForeignKey(
        "user.id"), nullable=True)  # optional assignee
    description = db.Column(db.String(500), nullable=False)
    # low | medium | high
    priority = db.Column(db.String(16), default="medium")
    due_date = db.Column(db.Date, nullable=True)
    # open | blocked | done
    status = db.Column(db.String(16), default="open")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignee = db.relationship("User", foreign_keys=[assignee_id])

    def to_dict(self):
        return {
            "id": self.id,
            "meeting_id": self.meeting_id,
            "assignee_id": self.assignee_id,
            "description": self.description,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# ---- IntegrationToken (for Google, Step 3) ----


class IntegrationToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    provider = db.Column(db.String(32), nullable=False)  # 'google'
    access_token_encrypted = db.Column(db.LargeBinary, nullable=False)
    refresh_token_encrypted = db.Column(db.LargeBinary, nullable=True)
    scopes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
