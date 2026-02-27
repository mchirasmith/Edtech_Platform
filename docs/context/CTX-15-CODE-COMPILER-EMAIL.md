# Agent Context — SPEC-15: Code Compiler & Transactional Email

## Your Task
Build two final features: (1) an in-browser code compiler using Monaco Editor on the frontend and a FastAPI Judge0 proxy on the backend with per-user rate limiting, and (2) a production-ready transactional email service using Resend. Also complete the production launch checklist.

## Pre-Conditions
- SPEC-02 done: `get_current_user` auth dependency
- SPEC-07 done: Purchase webhook exists (add email trigger here)
- SPEC-11 done: Test submission endpoint exists (add results email trigger here)

## Part 1: In-Browser Code Compiler

### Install
```bash
# Frontend
npm install @monaco-editor/react

# Backend — already installed: httpx
```
Add to `backend/.env`: `JUDGE0_API_KEY=your_rapidapi_key`
Add to `Settings` class in `config.py`: `JUDGE0_API_KEY: str`

### `backend/app/routers/compiler.py`
```python
from collections import defaultdict
from datetime import datetime, timedelta

# Rate limiter — max 10 submissions per user per minute
_log: dict = defaultdict(list)

def _check_rate_limit(clerk_id: str):
    now = datetime.utcnow()
    _log[clerk_id] = [t for t in _log[clerk_id] if t > now - timedelta(minutes=1)]
    if len(_log[clerk_id]) >= 10:
        raise HTTPException(429, "Rate limit: max 10 submissions/minute")
    _log[clerk_id].append(now)

LANGUAGE_IDS = {"python": 71, "javascript": 63, "cpp": 54, "java": 62, "c": 50}

# POST /compiler/run  (get_current_user)
# Body: {code, language, stdin?}
# 1. _check_rate_limit(clerk_id)
# 2. Lookup language_id → 400 if unsupported
# 3. Base64-encode code and stdin
# 4. httpx.AsyncClient().post("https://judge0-ce.p.rapidapi.com/submissions",
#      json={source_code, language_id, stdin, base64_encoded:True, wait:True},
#      headers={"X-RapidAPI-Key": JUDGE0_API_KEY, "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"})
# 5. Decode base64 response fields (stdout, stderr, compile_output)
# 6. Return: {stdout, stderr, compile_output, status (description string), time, memory}
```
Register in `main.py`.

### `frontend/src/components/CodeEditor.jsx`
```jsx
import Editor from "@monaco-editor/react";

// State: language, code, stdin, result, running
// Languages: ["python","javascript","cpp","java","c"]
// Starter code per language (STARTER_CODE map)

// handleRun:
//   setRunning(true)
//   POST /compiler/run with {code, language, stdin}
//   setResult(response)
//   setRunning(false)

// Layout (dark theme — bg-gray-900):
//   1. Toolbar: language selector + "▶ Run" button
//   2. Monaco Editor (height 60%, theme "vs-dark", minimap off)
//   3. Stdin textarea
//   4. Output panel: status badge + stdout/stderr pre block

// Status color mapping:
//   "Accepted" → green, "Runtime Error" → red, "Time Limit Exceeded" → yellow
```

## Part 2: Transactional Email

### `backend/app/services/email.py`
```python
import resend

def send_purchase_confirmation(to_email: str, student_name: str, course_title: str, amount: str):
    resend.api_key = settings.RESEND_API_KEY
    try:
        resend.Emails.send({
            "from": "EdTech <noreply@yourdomain.com>",
            "to": [to_email],
            "subject": f"You're enrolled in {course_title}!",
            "html": "... HTML with course name, amount, and link to /my-courses ..."
        })
    except Exception as e:
        print(f"Email error: {e}")  # Non-fatal — NEVER crash the webhook

def send_test_result(to_email: str, student_name: str, score: float, accuracy: float, percentile: int):
    # Similar pattern — send score summary, accuracy, and link to /tests/results
```

### Wire Email Triggers

In `routers/payments.py` webhook handler:
```python
background_tasks.add_task(send_purchase_confirmation, email, name, course.title, str(course.price))
```

In `routers/tests.py` submit endpoint:
```python
background_tasks.add_task(send_test_result, email, name, result["score"], result["accuracy_percent"], result["batch_percentile"])
```

> To get the student's email, call the Clerk API:
> `httpx.get(f"https://api.clerk.com/v1/users/{clerk_id}", headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"})`
> → `response.json()["email_addresses"][0]["email_address"]`

## Production Launch Checklist

Before going live, verify each of these:
- [ ] Switch Razorpay to **Live** mode (new key pair from Razorpay Dashboard → API Keys → Live)
- [ ] Switch Clerk to **Production** instance (new publishable + secret keys)
- [ ] All Render env vars updated with production values (not test keys)
- [ ] Vercel `VITE_CLERK_PUBLISHABLE_KEY` updated to production key
- [ ] `SESSION_URL` / allowed origins updated in Clerk Dashboard
- [ ] Resend domain verified (for `from:` not showing as spam)
- [ ] Redis is Upstash Production (not dev)
- [ ] Cron keep-alive job running on cron-job.org
- [ ] GitHub Actions pipeline is green on `main`

## Environment Variables
```env
# backend/.env
JUDGE0_API_KEY=your_rapidapi_key
```

## Done When
- [ ] `print("Hello")` in Python executes and returns `stdout: "Hello\n"` within 3s
- [ ] 11th code submission in 1 minute returns `429 Too Many Requests`
- [ ] Monaco Editor shows syntax highlighting for all 5 languages
- [ ] Purchase confirmation email received after Razorpay test payment
- [ ] Test result email shows score and batch percentile
- [ ] All production checklist items above are verified

## Read Next
Full code + launch checklist: `docs/specs/SPEC-15-CODE-COMPILER-EMAIL.md`
