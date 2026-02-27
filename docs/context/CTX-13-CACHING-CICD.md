# Agent Context — SPEC-13: Redis Caching & GitHub Actions CI/CD

## Your Task
Add Redis in-memory caching to high-read FastAPI endpoints using `fastapi-cache2`. Complete the GitHub Actions CI/CD pipeline to auto-deploy on merge to `main` — FastAPI to Render, React to Vercel.

## Pre-Conditions
- SPEC-01 done: CI skeleton `.github/workflows/ci.yml` exists with lint + build jobs
- Upstash Redis account created at [upstash.com](https://upstash.com) → copy `REDIS_URL`
- Render web service exists for the backend
- Vercel project exists for the frontend

## Part 1 — Redis Caching

### Install
```bash
pip install fastapi-cache2[redis] redis
```

### `backend/app/main.py` — Add Startup Event
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

@app.on_event("startup")
async def startup():
    redis = aioredis.from_url(settings.REDIS_URL, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="edtech-cache")
```

### Apply Cache Decorators
```python
from fastapi_cache.decorator import cache

# In courses.py:
@router.get("/catalog")
@cache(expire=300)  # 5 minutes
async def get_catalog(db: Session = Depends(get_db)):
    return db.query(Course).all()

# In batches.py:
@router.get("/")
@cache(expire=600)  # 10 minutes
async def list_batches(...):
    ...
```

**Important**: Change affected endpoint functions to `async def` (required for `@cache`).

### Cache Invalidation on Write
```python
from fastapi_cache import FastAPICache

# In courses.py — after creating/updating a course:
await FastAPICache.clear(namespace="edtech-cache")
```
Add this wherever catalog data changes (create/update/delete course).

## Part 2 — Complete CI/CD Pipeline

### Update `.github/workflows/ci.yml`
```yaml
# Add deploy jobs after the existing lint+test+build jobs:

deploy-backend:
  name: Deploy to Render
  needs: [backend-ci, frontend-ci]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  steps:
    - name: Trigger Render Deploy Hook
      run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"

deploy-frontend:
  name: Deploy to Vercel
  needs: [backend-ci, frontend-ci]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  steps:
    - uses: actions/checkout@v4
    - uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        working-directory: frontend
        vercel-args: "--prod"
```

### GitHub Secrets to Add
Go to **Repo → Settings → Secrets → Actions → New repository secret** for each:
```
RENDER_DEPLOY_HOOK_URL   ← Render Dashboard → Service → Deploy Hooks → Create
VERCEL_TOKEN             ← Vercel Account Settings → Tokens
VERCEL_ORG_ID            ← .vercel/project.json (after running: vercel in /frontend)
VERCEL_PROJECT_ID        ← .vercel/project.json
```
Also add all backend env vars as secrets (for the test runner):
`DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_DOMAIN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REDIS_URL`

### Render Setup (if not done)
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set all `.env` variables in Render Dashboard → Environment

### Keep-Alive (Render Free Tier)
Set up a cron at [cron-job.org](https://cron-job.org) to GET `https://your-api.onrender.com/docs` every 10 minutes to prevent cold starts.

## Environment Variables
```env
# backend/.env
REDIS_URL=redis://:password@host:port
```

## Done When
- [ ] `GET /courses/catalog` hits Redis on 2nd call (verify via logs or `REDIS_KEYS *`)
- [ ] Cache clears when a new course is created
- [ ] GitHub CI runs on every push and PR to `main`
- [ ] Merge to `main` triggers automatic Render + Vercel deploy
- [ ] Pull requests run CI only — no deploy
- [ ] Backend stays warm via cron-job.org keep-alive

## Read Next
Full details: `docs/specs/SPEC-13-CACHING-CICD.md`
