import os
from flask import Blueprint, session, request, redirect, jsonify
from models import db, IntegrationToken
from utils import encrypt_bytes, decrypt_bytes
from datetime import datetime, timezone

# Google OAuth / API
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
from oauthlib.oauth2.rfc6749.errors import OAuth2Error

bp_google = Blueprint("google", __name__, url_prefix="/google")

# Scopes we request
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
]
REQUIRED_CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"


# --------- helpers ---------
def _require_auth():
    """Gate endpoints behind our own session auth."""
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return uid, None


def _client_config():
    """Shape expected by Flow.from_client_config."""
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": "pm-dashboard",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")],
            "javascript_origins": [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
        }
    }


def _frontend_redirect(query: str = ""):
    """Build a safe redirect to the SPA with optional query string (starting with `?`)."""
    origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
    if query and not query.startswith("?"):
        query = "?" + query
    return redirect(f"{origin}/{query}")


# --------- routes ---------
@bp_google.get("/login")
def login():
    """Step 1: send user to Google's consent screen."""
    uid, err = _require_auth()
    if err:
        return err

    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    # Force a fresh consent to avoid scope merges that hide missing scopes
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes=False,
        prompt="consent",
    )

    session["google_oauth_state"] = state
    print("[GOOGLE OAUTH] auth_url:", auth_url)
    print("[GOOGLE OAUTH] requested scopes:", GOOGLE_SCOPES)
    return redirect(auth_url)


@bp_google.get("/callback")
def callback():
    """
    Step 2: Google returns code + (space-delimited) scopes.
    If calendar scope wasn't granted, bounce back with a friendly message.
    Then exchange code for tokens, store encrypted, and redirect home.
    """
    uid, err = _require_auth()
    if err:
        return err

    expected_state = session.pop("google_oauth_state", None)
    incoming_state = request.args.get("state")
    if not expected_state or incoming_state != expected_state:
        print("[GOOGLE OAUTH] state mismatch or missing.")
        return _frontend_redirect("google_error=state_mismatch")

    # What the user actually granted on the screen
    granted_from_query = set((request.args.get("scope") or "").split())
    print("[GOOGLE OAUTH] callback scope from query:", granted_from_query)

    if granted_from_query and REQUIRED_CAL_SCOPE not in granted_from_query:
        # User didn’t check the calendar box – guide them.
        return _frontend_redirect(
            "google_error=missing_calendar_scope"
            "&help=Please%20check%20the%20calendar%20permission%20box%20and%20try%20again"
        )

    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    try:
        # Exchange code for tokens
        flow.fetch_token(authorization_response=request.url)
    except OAuth2Error as e:
        print("[GOOGLE OAUTH] OAuth2Error during fetch_token:", repr(e))
        return _frontend_redirect("google_error=oauth_failed")

    creds = flow.credentials
    granted_scopes = set(creds.scopes or [])
    print("[GOOGLE OAUTH] granted scopes (token):", granted_scopes)

    # Save tokens (encrypted) + scopes
    access_tok = (creds.token or "").encode()
    refresh_tok = (creds.refresh_token or "").encode(
    ) if creds.refresh_token else None

    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if not tok:
        tok = IntegrationToken(
            user_id=uid,
            provider="google",
            access_token_encrypted=encrypt_bytes(access_tok),
            refresh_token_encrypted=encrypt_bytes(
                refresh_tok) if refresh_tok else b"",
            scopes=" ".join(granted_scopes),
        )
        db.session.add(tok)
    else:
        tok.access_token_encrypted = encrypt_bytes(access_tok)
        if refresh_tok:
            tok.refresh_token_encrypted = encrypt_bytes(refresh_tok)
        tok.scopes = " ".join(granted_scopes)
    db.session.commit()

    # If still missing calendar: inform the UI
    if REQUIRED_CAL_SCOPE not in granted_scopes:
        return _frontend_redirect(
            "google_error=missing_calendar_scope"
            "&help=Calendar%20permission%20was%20not%20granted.%20Click%20Connect%20Google%20again%20and%20check%20the%20box."
        )

    return _frontend_redirect()


def _load_credentials(tok: IntegrationToken) -> Credentials:
    """Rehydrate google Credentials from encrypted DB tokens."""
    access = decrypt_bytes(tok.access_token_encrypted).decode()
    refresh = None
    if tok.refresh_token_encrypted:
        try:
            refresh = decrypt_bytes(tok.refresh_token_encrypted).decode()
        except Exception:
            refresh = None

    scopes = tok.scopes.split() if tok.scopes else GOOGLE_SCOPES
    return Credentials(
        token=access,
        refresh_token=refresh,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=scopes,
    )


@bp_google.get("/status")
def status():
    """Used by the SPA to know if Google is connected and if calendar scope is present."""
    uid, err = _require_auth()
    if err:
        return err

    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    has_calendar = False
    if tok and tok.scopes:
        has_calendar = REQUIRED_CAL_SCOPE in tok.scopes.split()

    return jsonify({"connected": bool(tok), "hasCalendar": has_calendar}), 200


@bp_google.get("/events")
def list_events():
    """Smoke test: list next 10 events from the user's primary calendar."""
    uid, err = _require_auth()
    if err:
        return err

    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if not tok:
        return jsonify({"error": "not_connected"}), 400

    # Missing scope? Tell the UI so it can show guidance.
    if REQUIRED_CAL_SCOPE not in (tok.scopes.split() if tok.scopes else []):
        return jsonify({"error": "missing_calendar_scope"}), 403

    creds = _load_credentials(tok)

    # Refresh access token if expired
    if not creds.valid and creds.refresh_token:
        creds.refresh(GoogleRequest())
        tok.access_token_encrypted = encrypt_bytes(
            (creds.token or "").encode())
        db.session.commit()

    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    now = datetime.now(timezone.utc).isoformat()
    events_result = (
        service.events()
        .list(calendarId="primary", timeMin=now, maxResults=10, singleEvents=True, orderBy="startTime")
        .execute()
    )
    items = events_result.get("items", [])
    out = [
        {
            "id": e.get("id"),
            "summary": e.get("summary"),
            "start": e.get("start", {}).get("dateTime") or e.get("start", {}).get("date"),
            "end": e.get("end", {}).get("dateTime") or e.get("end", {}).get("date"),
            "htmlLink": e.get("htmlLink"),
        }
        for e in items
    ]
    return jsonify(out), 200


@bp_google.delete("/disconnect")
def disconnect():
    """Optional: remove stored Google tokens for this user (useful during dev)."""
    uid, err = _require_auth()
    if err:
        return err
    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if tok:
        db.session.delete(tok)
        db.session.commit()
    return jsonify({"ok": True})
