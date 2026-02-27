# SPEC-13 — Redis Caching & GitHub Actions CI/CD

| Field | Value |
|-------|-------|
| **Module** | Redis Caching, GitHub Actions Pipeline, Render + Vercel Deployment |
| **Phase** | Phase 3 |
| **Week** | Week 7 |
| **PRD Refs** | NFR-01, NFR-09, Section 7 (CI/CD row) |
| **Depends On** | SPEC-01 (Project Setup — CI skeleton) |

---

## 1. Overview

This spec covers adding Redis caching to FastAPI's high-read endpoints (course catalog, batch listing) using `fastapi-cache2`, and completing the GitHub Actions CI/CD pipeline that lints, tests, and auto-deploys to Render (backend) and Vercel (frontend) on every merge to `main`.

---

## 2. Redis Caching — Backend

### Installation

```bash
pip install fastapi-cache2[redis] redis
```

### Setup in `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis
from app.config import settings

app = FastAPI()

@app.on_event("startup")
async def startup():
    redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf8",
        decode_responses=True,
    )
    FastAPICache.init(RedisBackend(redis), prefix="edtech-cache")
```

### Caching High-Traffic Endpoints

```python
from fastapi_cache.decorator import cache

# Course catalog — cached for 5 minutes
@router.get("/courses/catalog")
@cache(expire=300)
async def get_catalog(db: Session = Depends(get_db)):
    return db.query(Course).all()

# Batch listing — cached for 10 minutes
@router.get("/batches/")
@cache(expire=600)
async def list_batches(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Batch).all()
```

> **Cache Invalidation**: When a teacher creates or updates a course, call `await FastAPICache.clear(namespace="edtech-cache")` to flush stale cache.

```python
from fastapi_cache import FastAPICache

@router.post("/courses/")
async def create_course(payload: CourseCreate, ...):
    # ... create course
    await FastAPICache.clear(namespace="edtech-cache")  # Flush catalog cache
    return course
```

### Upstash Redis (Free Tier)

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database (select the region closest to your Render deployment)
3. Copy the `REDIS_URL` from the Upstash console (format: `redis://:password@host:port`)

---

## 3. GitHub Actions CI/CD

### Complete Pipeline — `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "20"

jobs:
  # ── Backend: Lint + Test ───────────────────────────────────────────────────
  backend-ci:
    name: Backend CI (Lint + Test)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Lint with Ruff
        run: |
          pip install ruff
          ruff check app/

      - name: Run Tests
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
          CLERK_DOMAIN: ${{ secrets.CLERK_DOMAIN }}
          RAZORPAY_KEY_ID: ${{ secrets.RAZORPAY_KEY_ID }}
          RAZORPAY_KEY_SECRET: ${{ secrets.RAZORPAY_KEY_SECRET }}
          IMAGEKIT_PRIVATE_KEY: ${{ secrets.IMAGEKIT_PRIVATE_KEY }}
          IMAGEKIT_PUBLIC_KEY: ${{ secrets.IMAGEKIT_PUBLIC_KEY }}
          IMAGEKIT_URL_ENDPOINT: ${{ secrets.IMAGEKIT_URL_ENDPOINT }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
        run: pytest tests/ -v --tb=short

  # ── Frontend: Build Check ─────────────────────────────────────────────────
  frontend-ci:
    name: Frontend CI (Build)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_RAZORPAY_KEY_ID: ${{ secrets.VITE_RAZORPAY_KEY_ID }}
          VITE_IMAGEKIT_PUBLIC_KEY: ${{ secrets.VITE_IMAGEKIT_PUBLIC_KEY }}
          VITE_IMAGEKIT_URL_ENDPOINT: ${{ secrets.VITE_IMAGEKIT_URL_ENDPOINT }}
        run: npm run build

  # ── Deploy Backend to Render ──────────────────────────────────────────────
  deploy-backend:
    name: Deploy to Render
    needs: [backend-ci, frontend-ci]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Trigger Render Deploy
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
        # Render deploy hook URL: Dashboard → Service → Deploy Hooks → Create

  # ── Deploy Frontend to Vercel ─────────────────────────────────────────────
  deploy-frontend:
    name: Deploy to Vercel
    needs: [backend-ci, frontend-ci]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
          vercel-args: "--prod"
```

---

## 4. Render Deployment Setup

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo → Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all env variables from `.env` in the Render dashboard
6. Go to **Settings → Deploy Hooks** → Create hook → copy URL to GitHub secret `RENDER_DEPLOY_HOOK_URL`

**Keep-Alive Cronjob** (prevents Render free-tier cold starts):
```bash
# Add to cron-job.org: every 10 minutes
# URL: https://your-api.onrender.com/docs
# Method: GET
```

---

## 5. Vercel Deployment Setup

```bash
npm install -g vercel
cd frontend
vercel --prod   # Follow prompts to link project
```

Add to GitHub Secrets:
- `VERCEL_TOKEN` — from Vercel Account Settings → Tokens
- `VERCEL_ORG_ID` — from `.vercel/project.json`
- `VERCEL_PROJECT_ID` — from `.vercel/project.json`

---

## 6. GitHub Secrets Required

Add these in **GitHub → Repo → Settings → Secrets → Actions**:

```
TEST_DATABASE_URL, CLERK_SECRET_KEY, CLERK_DOMAIN, CLERK_WEBHOOK_SECRET
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_URL_ENDPOINT
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY, REDIS_URL
RENDER_DEPLOY_HOOK_URL
VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL, VITE_RAZORPAY_KEY_ID
VITE_IMAGEKIT_PUBLIC_KEY, VITE_IMAGEKIT_URL_ENDPOINT
```

---

## 7. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 | Add `fastapi-cache2[redis]` to requirements. Set up Upstash Redis. Wire up `FastAPICache.init` in startup. |
| Day 2 | Add `@cache` decorator to catalog and batch endpoints. Test cache hit/miss. |
| Day 3 | Write complete `ci.yml`. Add all secrets to GitHub. Push and verify CI passes. |
| Day 4 | Set up Render web service. Connect deploy hook. Test deploy on push to main. |
| Day 5 | Set up Vercel project. Connect via GitHub Action. Test frontend deploy on push. |

---

## 8. Acceptance Criteria

- [ ] `GET /courses/catalog` is served from Redis cache after the first request (verify with logs)
- [ ] Cache is invalidated when a new course is created
- [ ] GitHub Actions CI passes (green) on push to main
- [ ] Push to `main` automatically deploys FastAPI to Render and React to Vercel
- [ ] PRs run CI but do NOT trigger deployment
- [ ] Backend stays warm (no cold start) with the cron-job.org ping

---

## 9. Environment Variables Introduced

```env
# Backend .env
REDIS_URL=redis://:password@host:port
```
