import os
import json
from urllib.parse import urlparse
from flask import Blueprint, session, request, redirect, jsonify
from models import db, IntegrationToken
from utils import encrypt_bytes, decrypt_bytes
from datetime import datetime, timezone

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
# NEW: catch scope mismatch cleanly
from oauthlib.oauth2.rfc6749.errors import MismatchingScopeError, OAuth2Error

bp_google = Blueprint("google", __name__, url_prefix="/google")

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
]

REQUIRED_CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"


def _require_auth():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return uid, None


def _client_config():
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


def _frontend_redirect(path_with_query: str) -> str:
    """Helper to build a safe redirect back to the SPA with query params."""
    origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
    return f"{origin}{path_with_query}"


@bp_google.get("/login")
def login():
    uid, err = _require_auth()
    if err:
        return err

    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes=False,
        prompt="consent",
    )

    print("[GOOGLE OAUTH] auth_url:", auth_url)
    print("[GOOGLE OAUTH] requested scopes:", GOOGLE_SCOPES)

    session["google_oauth_state"] = state
    return redirect(auth_url)


@bp_google.get("/callback")
def callback():
    """
    Graceful handling for the 'unchecked checkbox' case:
    - Google includes a 'scope' query param in the callback.
    - If that set does NOT include calendar.readonly, we either:
        (A) Soft-connect: still exchange and store tokens, but mark hasCalendar=false,
            then redirect the user with a helpful message to fix permissions.
        (B) Hard-fail: do NOT exchange tokens; redirect with an error telling them to retry.
    Below we implement (A) Soft-connect, which provides the best UX.
    """
    uid, err = _require_auth()
    if err:
        return err

    state = session.get("google_oauth_state")
    if not state:
        return jsonify({"error": "state missing"}), 400

    # What scopes does Google say were granted on the consent screen?
    raw_scope = request.args.get("scope") or ""
    granted_from_query = set(raw_scope.split()) if raw_scope else set()
    print("[GOOGLE OAUTH] callback 'scope' param:", granted_from_query)

    # Build the Flow object used for token exchange
    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    try:
        flow.fetch_token(authorization_response=request.url)
    except MismatchingScopeError as e:
        # Defensive: if oauthlib still complains, redirect with a clear message.
        print("[GOOGLE OAUTH] MismatchingScopeError:", str(e))
        help_url = _frontend_redirect(
            "/?google_error=missing_calendar_scope"
            "&help=Please%20check%20the%20calendar%20permission%20box%20and%20try%20again"
        )
        return redirect(help_url)
    except OAuth2Error as e:
        # Any other OAuth2 failure → send a generic error back to the SPA
        print("[GOOGLE OAUTH] OAuth2Error:", str(e))
        help_url = _frontend_redirect("/?google_error=oauth_failed")
        return redirect(help_url)

    creds = flow.credentials  # google.oauth2.credentials.Credentials

    access_tok = (creds.token or "").encode()
    refresh_tok = (creds.refresh_token or "").encode(
    ) if creds.refresh_token else None

    # Persist what Google ACTUALLY granted after token exchange
    granted_scopes = set(creds.scopes or [])
    print("[GOOGLE OAUTH] granted scopes (tokens):", granted_scopes)

    # ----- Soft-connect behavior -----
    # We store tokens even if calendar scope is missing, so the app can still
    # recognize the account connection and show a banner to fix permissions.
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

    # If calendar scope is missing, bounce back with a clear query string the UI can read.
    if REQUIRED_CAL_SCOPE not in granted_scopes:
        help_url = _frontend_redirect(
            "/?google_error=missing_calendar_scope"
            "&help=Calendar%20permission%20was%20not%20granted.%20Click%20Connect%20Google%20again%20and%20check%20the%20box."
        )
        return redirect(help_url)

    # All good → redirect home
    return redirect(_frontend_redirect("/"))


def _load_credentials(tok: IntegrationToken) -> Credentials:
    access = decrypt_bytes(tok.access_token_encrypted).decode()
    refresh = None
    if tok.refresh_token_encrypted:
        try:
            refresh = decrypt_bytes(tok.refresh_token_encrypted).decode()
        except Exception:
            refresh = None

    # Use what we actually stored (granted scopes). If somehow empty, fall back to desired.
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
    """
    Tell the UI:
      - connected: do we have ANY Google token saved?
      - hasCalendar: did the user grant calendar.readonly?
    This lets the frontend show a banner like:
      “Google connected, but calendar permission is missing – Fix”
    """
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
    uid, err = _require_auth()
    if err:
        return err

    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if not tok:
        return jsonify({"error": "not_connected"}), 400

    # If they didn’t grant the calendar scope, short-circuit with a clear error
    if REQUIRED_CAL_SCOPE not in (tok.scopes.split() if tok.scopes else []):
        return jsonify({"error": "missing_calendar_scope"}), 403

    creds = _load_credentials(tok)

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
    events = events_result.get("items", [])
    out = []
    for e in events:
        out.append({
            "id": e.get("id"),
            "summary": e.get("summary"),
            "start": e.get("start", {}).get("dateTime") or e.get("start", {}).get("date"),
            "end":   e.get("end",   {}).get("dateTime") or e.get("end",   {}).get("date"),
            "htmlLink": e.get("htmlLink"),
        })
    return jsonify(out), 200
