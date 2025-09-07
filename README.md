# PM Productivity Dashboard

## 📌 Overview

The **PM Productivity Dashboard** is a full-stack productivity app for project managers and teams. It helps capture **meeting notes**, generate **AI-powered summaries**, sync with **Google Calendar**, and manage **action items** — all in one central hub.

This MVP demonstrates:

- **Secure authentication**
- **Meeting CRUD workflows**
- **Automated summarization (OpenAI-powered, with fallback)**
- **Action item tracking**
- **Google Calendar OAuth integration**
- **Polished React frontend using Material UI**

---

## 🚀 Features

### Backend (Flask)

- **Authentication**
  - Signup, Login, Logout
  - Session-based, secure with bcrypt
- **Meetings**
  - Create, list, update, delete
  - Raw notes + metadata (title, date, attendees)
- **Summarization**
  - AI-powered via OpenAI (`gpt-4o-mini`)
  - Stub fallback parser for offline/dev use
  - Strict JSON schema validation
  - Content hash + ETag support for caching
- **Action Items**
  - Linked to meetings
  - CRUD (description, status, priority, due date, assignee)
- **Google Integration**
  - OAuth2 login with Google
  - Securely stores encrypted access/refresh tokens
  - Fetches upcoming calendar events
  - Gracefully handles missing scope (e.g., user doesn’t check the “calendar access” box)

### Frontend (React + MUI)

- **Authentication flow**
  - Login/signup forms
  - Session persistence across refresh
- **Meetings dashboard**
  - Create new meetings
  - List all meetings
  - Navigate to meeting details
- **Meeting detail page**
  - Edit + save raw notes
  - Trigger AI summarization
  - Display structured summary (bullets, decisions)
  - Add/manage action items
- **Google Calendar integration**
  - Connect / re-connect Google
  - Import calendar events as meetings
  - UI feedback if calendar scope is missing
- **Design**
  - Material UI components
  - Custom theming
  - Responsive layout
  - Navigation bar with user greeting & logout

---

## 🛠️ Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate, bcrypt, OpenAI API, Google API Client
- **Frontend:** React (Vite), Material UI, React Router
- **Database:** SQLite (dev), ready for PostgreSQL in production
- **Auth:** Session cookies with SameSite + HttpOnly
- **APIs:** Google OAuth 2.0, Google Calendar API

---

## ⚙️ Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- OpenAI API key (for full summarization)
- Google Cloud OAuth client (Client ID, Secret, Redirect URI)

### Setup – Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and add your OpenAI key + Google OAuth credentials
flask db upgrade
python app.py
```

### Setup – Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at:

- Backend: http://localhost:5000
- Frontend: http://localhost:5173

---

## 🔑 Environment Variables

### Backend (.env)

```ini
FLASK_ENV=development
FLASK_SECRET_KEY=change-me
DATABASE_URL=sqlite:///app.db
FRONTEND_ORIGIN=http://localhost:5173

# OpenAI integration
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o-mini
PROMPT_VERSION=v1

# Google OAuth integration
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/google/callback

# Local dev helpers
# Allow HTTP for OAuth in local dev ONLY
OAUTHLIB_INSECURE_TRANSPORT=1
```

---

## 🚀 Core Features

- **Authentication** – session-based login/signup/logout with Flask + bcrypt
- **Meetings** – create, edit, delete, and fetch meetings with notes & dates
- **Summarization** – AI-powered (OpenAI GPT) or stub fallback, schema-validated
- **Action Items** – add, update, complete, or delete items linked to meetings
- **Google Calendar** – connect account, import events, graceful handling if the user forgets to check the calendar permission box
- **ETag caching** – efficient fetches, prevents redundant summarization calls
- **Frontend** – React + Vite + MUI dashboard with Meetings and Meeting Detail pages

---

## 📦 Tech Stack

**Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate, bcrypt, OpenAI API, Google API Client  
**Frontend:** React (Vite), React Router, Material UI (MUI)  
**Database:** SQLite (easy local dev), via SQLAlchemy ORM

---

## 🧪 Testing

- Backend tested via `curl` and session cookies for auth + CRUD endpoints
- Summarization tested with both stub + OpenAI provider
- Google Calendar integration tested with valid OAuth and with the “missing calendar scope” path
- Frontend tested manually: login, meetings list, meeting details, summarization, action items, Google connect flow

---

## 👤 Author & Project Context

**Created by:** Andrew Snyder  
**Program:** Flatiron School – Software Engineering  
**Context:** This application was developed as part of the Flatiron School Software Development program to demonstrate full-stack engineering skills—covering backend APIs (Flask/SQLAlchemy), frontend UI/UX (React + MUI), authentication, database modeling, and integrations with both AI and Google APIs for real-world productivity use cases.
