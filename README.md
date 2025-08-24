# PM Productivity Dashboard

## 📌 Overview

The **PM Productivity Dashboard** is a full-stack productivity app for project managers and teams. It helps capture **meeting notes**, generate **AI-powered summaries**, and manage **action items** — all in one central hub.

This MVP demonstrates:

- **Secure authentication**
- **Meeting CRUD workflows**
- **Automated summarization (OpenAI-powered, with fallback)**
- **Action item tracking**
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
- **Design**
  - Material UI components
  - Custom theming
  - Responsive layout
  - Navigation bar with user greeting & logout

---

## 🛠️ Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate, bcrypt, OpenAI API
- **Frontend:** React (Vite), Material UI, React Router
- **Database:** SQLite (dev), ready for PostgreSQL in production
- **Auth:** Session cookies with SameSite + HttpOnly

---

## ⚙️ Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- OpenAI API key (for full summarization)

### Setup – Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and add your OpenAI key
flask db upgrade
python app.py
```

### Setup – Frontend

# Run these commands

cd frontend
npm install
npm run dev

The app will be available at:

- Backend: http://localhost:5000
- Frontend: http://localhost:5173

---

## 🔑 Environment Variables

### Backend (.env)

FLASK_ENV=development  
FLASK_SECRET_KEY=change-me  
DATABASE_URL=sqlite:///app.db  
FRONTEND_ORIGIN=http://localhost:5173

# Optional: OpenAI integration

LLM_PROVIDER=openai  
OPENAI_API_KEY=your-key-here  
OPENAI_MODEL=gpt-4o-mini  
PROMPT_VERSION=v1

---

## 🚀 Features

- **Authentication** – session-based login/signup/logout with Flask + bcrypt
- **Meetings** – create, edit, delete, and fetch meetings with notes & dates
- **Summarization** – AI-powered (OpenAI GPT) or stub fallback, schema-validated
- **Action Items** – add, update, complete, or delete items linked to meetings
- **ETag caching** – efficient fetches, prevents redundant summarization calls
- **Frontend** – React + Vite + MUI dashboard with Meetings and Meeting Detail pages
- **Extensible** – groundwork laid for Google Calendar + Slack integrations

---

## 📦 Tech Stack

**Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate, bcrypt, OpenAI API  
**Frontend:** React (Vite), React Router, Material UI (MUI)  
**Database:** SQLite (easy local dev), via SQLAlchemy ORM

---

## 🧪 Testing

- Backend tested via `curl` and session cookies for auth + CRUD endpoints
- Summarization tested with both stub + OpenAI provider
- Frontend tested manually: login, meetings list, meeting details, summarization, action items

## 👤 Author & Project Context

**Created by:** Andrew Snyder  
**Program:** Flatiron School – Software Engineering  
**Context:** This application was developed as part of the Flatiron School Software Development program to demonstrate full-stack engineering skills—covering backend APIs (Flask/SQLAlchemy), frontend UI/UX (React + MUI), authentication, database modeling, and AI integration for real-world productivity use cases.
