# Agent Context — SPEC-01: Project Setup & Repository Structure

## Your Task
Scaffold the full monorepo for the EdTech platform. Create the frontend (React + Vite) and backend (FastAPI) project structures, wire up environment variable loading, configure CORS, and add a skeleton GitHub Actions CI pipeline.

## Project Overview
- **App**: Cohort-based EdTech platform for JEE/NEET aspirants
- **Stack**: React + Vite + Tailwind CSS (frontend) | FastAPI + SQLAlchemy (backend)
- **Auth**: Clerk (handled in SPEC-02 — leave as placeholder here)
- **DB**: Supabase PostgreSQL (connection wired here, schema in SPEC-03)

## Monorepo Layout to Create
```
edtech-platform/
├── frontend/          ← Vite + React app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   ├── .env.local
│   └── package.json
├── backend/           ← FastAPI app
│   ├── app/
│   │   ├── routers/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── dependencies/
│   │   ├── services/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
└── .github/workflows/ci.yml
```

## Files to Create

### `backend/app/config.py`
Use `pydantic-settings` `BaseSettings`. Load from `.env`. Include ALL these fields:
`DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REDIS_URL` (default `""`), `FRONTEND_URL` (default `"http://localhost:5173"`).

### `backend/app/database.py`
```python
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
def get_db(): ...  # yield + finally close
```

### `backend/app/main.py`
- Create `FastAPI` app
- Add `CORSMiddleware` with `allow_origins=[settings.FRONTEND_URL]`
- Router registrations are commented placeholders for now

### `frontend/` scaffold
```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install tailwindcss @tailwindcss/vite @clerk/clerk-react react-router-dom axios
```

### `vite.config.js`
Include `@tailwindcss/vite` plugin and proxy `/api → localhost:8000`.

### `.github/workflows/ci.yml`
Two jobs: `backend-ci` (ruff lint + pytest) and `frontend-ci` (npm ci + npm run build). No deploy steps yet (added in SPEC-13).

## Key Dependencies to Install
```bash
# Backend
pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic pydantic-settings \
            python-dotenv python-jose[cryptography] httpx razorpay imagekitio \
            supabase svix resend fastapi-cache2[redis] redis
```

## Environment Variables
```env
# frontend/.env.local
VITE_API_URL=http://localhost:8000

# backend/.env
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgres://...  (get from Supabase project settings)
```

## Done When
- [ ] `npm run dev` starts frontend on `localhost:5173`
- [ ] `uvicorn app.main:app --reload` starts backend on `localhost:8000`
- [ ] `GET http://localhost:8000/docs` returns Swagger UI
- [ ] GitHub Actions CI workflow file exists and is syntactically valid
- [ ] `.env` and `.env.local` are in `.gitignore`

## Read Next
Full implementation details: `docs/specs/SPEC-01-PROJECT-SETUP.md`
