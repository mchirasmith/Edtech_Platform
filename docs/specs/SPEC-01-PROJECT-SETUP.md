# SPEC-01 — Project Setup & Repository Structure

| Field | Value |
|-------|-------|
| **Module** | Project Scaffolding |
| **Phase** | Phase 1 |
| **Week** | Week 1 (Days 1–2) |
| **PRD Refs** | Section 6.1 Tech Stack Summary |
| **Depends On** | None — this is the first spec |

---

## 1. Overview

This spec covers the full project scaffolding: folder structure for both the React frontend and FastAPI backend, environment variable setup, shared tooling (ESLint, Prettier, Black, Ruff), and the skeleton GitHub Actions CI pipeline. Every subsequent spec builds on top of this foundation.

---

## 2. Repository Structure

```
edtech-platform/
├── frontend/                   # React + Vite app
│   ├── public/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level page components
│   │   ├── hooks/              # Custom React hooks (useFetch, useAuth, etc.)
│   │   ├── lib/                # Utility functions, constants
│   │   └── main.jsx            # App entry point
│   ├── .env.local              # Frontend env vars (NEVER commit)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                    # FastAPI app
│   ├── app/
│   │   ├── routers/            # One file per domain (courses, payments, media, etc.)
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── dependencies/       # Shared FastAPI dependencies (auth, db)
│   │   ├── services/           # Business logic (separate from route handlers)
│   │   ├── config.py           # Settings loaded from .env via pydantic-settings
│   │   ├── database.py         # SQLAlchemy engine + SessionLocal + get_db
│   │   └── main.py             # FastAPI app creation, router registration, CORS
│   ├── alembic/                # Database migrations
│   ├── tests/                  # pytest test suite
│   ├── .env                    # Backend env vars (NEVER commit)
│   ├── requirements.txt
│   └── Procfile                # For Render deployment: web: uvicorn app.main:app ...
│
├── docs/
│   ├── PRD.md
│   ├── Implementation_Roadmap_v2.md
│   └── specs/                  # ← All 15 spec documents live here
│
└── .github/
    └── workflows/
        └── ci.yml              # GitHub Actions CI pipeline (lint + test + deploy)
```

---

## 3. Frontend Scaffold

```bash
# In the project root
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install tailwindcss @tailwindcss/vite
npm install @clerk/clerk-react react-router-dom axios
```

**`vite.config.js`**:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
```

---

## 4. Backend Scaffold

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic \
            pydantic-settings python-dotenv python-jose[cryptography] \
            httpx razorpay imagekitio supabase svix resend
pip freeze > requirements.txt
```

**`app/main.py`**:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="EdTech API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers are registered here as each module spec is completed
# from app.routers import courses, payments, media, batches, tests, admin
# app.include_router(courses.router)
```

**`app/config.py`**:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str
    CLERK_DOMAIN: str
    CLERK_WEBHOOK_SECRET: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    IMAGEKIT_PRIVATE_KEY: str
    IMAGEKIT_PUBLIC_KEY: str
    IMAGEKIT_URL_ENDPOINT: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    RESEND_API_KEY: str
    REDIS_URL: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 5. GitHub Actions CI Skeleton

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r backend/requirements.txt
      - run: ruff check backend/
      - run: pytest backend/tests/ -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci --prefix frontend
      - run: npm run build --prefix frontend
```

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 AM | Create GitHub repo. Scaffold frontend with Vite + React. |
| Day 1 PM | Scaffold FastAPI backend. Install all dependencies. |
| Day 2 AM | Write `config.py`, `database.py`, `main.py` skeletons. Add `.env` files (gitignored). |
| Day 2 PM | Add GitHub Actions CI skeleton. Push to GitHub. Verify CI passes. |

---

## 7. Acceptance Criteria

- [ ] `npm run dev` starts the Vite dev server on `localhost:5173`
- [ ] `uvicorn app.main:app --reload` starts FastAPI on `localhost:8000`
- [ ] `GET /docs` renders the FastAPI Swagger UI
- [ ] GitHub Actions CI runs on push and shows green for lint + build
- [ ] `.env` files are in `.gitignore` and do not appear in the repo

---

## 8. Environment Variables Introduced

```env
# Frontend .env.local
VITE_API_URL=http://localhost:8000

# Backend .env
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgres://... (from Supabase)
```
