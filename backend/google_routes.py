import os
import json
from urllib.parse import urlparse
from flask import Blueprint, session, request, redirect, jsonify
from models import db, IntegrationToken
from utils import encrypt_bytes, decrypt_bytes
from datetime import datetime, timezone

# Google OAuth / API client libs
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest

# All Google-related endpoints are registered under /google/*
bp_google = Blueprint("google", __name__, url_prefix="/google")

# --- Scopes we are REQUESTING from Google ---
# - openid + userinfo.email let us see the user’s email (identity-light)
# - calendar.readonly is the key scope we need to read calendar events
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def _require_auth():
    """
    Simple session check.
    Gating all Google endpoints behind the app's own auth (session cookie).
    Returns (user_id, None) if authed, else (None, error_response).
    """
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "unauthorized"}), 401)
    return uid, None


def _client_config():
    """
    Small helper that returns the exact structure expected by
    google_auth_oauthlib.flow.Flow.from_client_config(...).

    Values are pulled from environment variables that are set from
    Google Cloud Console OAuth Client (Web application type):
      - GOOGLE_CLIENT_ID
      - GOOGLE_CLIENT_SECRET
      - GOOGLE_REDIRECT_URI  (http://localhost:5000/google/callback)

    IMPORTANT:
    - The redirect URI must EXACTLY match what's configured in Google Cloud.
    - The OAuth client created must be of type "Web application".
    """
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": "pm-dashboard",  # not functionally used by Flow, just metadata
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")],
            # The SPA origin—used by Google to validate JavaScript origins if you ever use JS flow.
            "javascript_origins": [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
        }
    }


@bp_google.get("/login")
def login():
    """
    Step 1 of OAuth: build an authorization URL and redirect the user to Google.

    Key choices here:
    - access_type="offline": ask for a refresh_token the first time the user consents.
    - include_granted_scopes=False: DO NOT silently reuse a previous narrower grant.
      I want Google to consider THIS set of scopes authoritative each time so
      I can detect if it drops "calendar.readonly".
    - prompt="consent": force the consent screen to show (avoid silent merges).

    Stash the "state" in our session for CSRF protection.
    """
    uid, err = _require_auth()
    if err:
        return err

    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    # Force a clean consent (do NOT merge with old grants)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes=False,  # boolean, not string
        prompt="consent",
    )

    # Debug logging: verifies the exact scopes encoded in the URL we send the user to
    print("[GOOGLE OAUTH] auth_url:", auth_url)
    print("[GOOGLE OAUTH] requested scopes:", GOOGLE_SCOPES)

    session["google_oauth_state"] = state
    return redirect(auth_url)


@bp_google.get("/callback")
def callback():
    """
    Step 2 of OAuth: Google redirects back here with a code.
    We exchange the code for tokens at the token endpoint.

    If Google returns FEWER scopes than requested (scope mismatch),
    oauthlib raises a warning/exception. THIS IS THE ERROR.

    After success:
    - Store access/refresh tokens encrypted in IntegrationToken
    - Save the granted scopes as a space-delimited string in the DB (tok.scopes)
    - Redirect back to the SPA
    """
    uid, err = _require_auth()
    if err:
        return err

    state = session.get("google_oauth_state")
    if not state:
        return jsonify({"error": "state missing"}), 400

    flow = Flow.from_client_config(
        _client_config(),
        scopes=GOOGLE_SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )

    # The authorization_response must be the full callback URL Google called (contains code+state)
    # This call exchanges the code for tokens. If Google drops a scope, oauthlib will complain here.
    flow.fetch_token(authorization_response=request.url)

    creds = flow.credentials  # google.oauth2.credentials.Credentials

    # Capture just the tokens; encrypt before storing.
    access_tok = (creds.token or "").encode()
    refresh_tok = (creds.refresh_token or "").encode(
    ) if creds.refresh_token else None

    # Upsert IntegrationToken for this user and provider='google'
    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if not tok:
        tok = IntegrationToken(
            user_id=uid,
            provider="google",
            access_token_encrypted=encrypt_bytes(access_tok),
            refresh_token_encrypted=encrypt_bytes(
                refresh_tok) if refresh_tok else b"",
            # <-- what Google ACTUALLY granted
            scopes=" ".join(creds.scopes or []),
        )
        db.session.add(tok)
    else:
        tok.access_token_encrypted = encrypt_bytes(access_tok)
        if refresh_tok:
            tok.refresh_token_encrypted = encrypt_bytes(refresh_tok)
        tok.scopes = " ".join(creds.scopes or [])
    db.session.commit()

    # UX: back to SPA home (could show a toast "Google connected")
    return redirect(os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"))


def _load_credentials(tok: IntegrationToken) -> Credentials:
    """
    Build a google.oauth2.credentials.Credentials object from encrypted tokens in DB.
    - Decrypt access and refresh tokens
    - Provide client_id/client_secret so google-auth can refresh for us
    - Use the scopes we actually stored for this token
    """
    access = decrypt_bytes(tok.access_token_encrypted).decode()
    refresh = None
    if tok.refresh_token_encrypted:
        try:
            refresh = decrypt_bytes(tok.refresh_token_encrypted).decode()
        except Exception:
            refresh = None

    return Credentials(
        token=access,
        refresh_token=refresh,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=tok.scopes.split() if tok.scopes else GOOGLE_SCOPES,
    )


@bp_google.get("/status")
def status():
    """
    Quick “connected?” check for the frontend.
    If an IntegrationToken exists for this user/provider, say connected.
    """
    uid, err = _require_auth()
    if err:
        return err
    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    return jsonify({"connected": bool(tok)}), 200


@bp_google.get("/events")
def list_events():
    """
    Smoke test: list the next 10 upcoming events on the user's primary calendar.

    Steps:
    - Load and refresh credentials if needed (handles expired access token)
    - Call Calendar API (events.list)
    - Return a compact array the UI can render
    """
    uid, err = _require_auth()
    if err:
        return err

    tok = IntegrationToken.query.filter_by(
        user_id=uid, provider="google").first()
    if not tok:
        return jsonify({"error": "not_connected"}), 400

    creds = _load_credentials(tok)

    # Refresh access token, if expired and refresh_token exists
    if not creds.valid and creds.refresh_token:
        creds.refresh(GoogleRequest())
        # persist refreshed access token
        tok.access_token_encrypted = encrypt_bytes(
            (creds.token or "").encode())
        db.session.commit()

    # Build Calendar API service
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    now = datetime.now(timezone.utc).isoformat()
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=now,
            maxResults=10,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])

    # Trim fields for UI
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
