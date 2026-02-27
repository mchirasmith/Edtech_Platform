# SPEC-15 — In-Browser Code Compiler & Transactional Email

| Field | Value |
|-------|-------|
| **Module** | Monaco Editor + Judge0 API, Resend Transactional Emails, Production Launch |
| **Phase** | Phase 3 |
| **Week** | Weeks 9–10 |
| **PRD Refs** | Section 4.8 (Code Compiler via Judge0), Section 10 (Email Notifications) |
| **Depends On** | SPEC-01 (Project Setup), SPEC-07 (Payments — email triggered on purchase) |

---

## 1. Overview

This spec covers two final production features: (1) an in-browser code compiler using Monaco Editor on the frontend and a FastAPI proxy to the Judge0 API on the backend, and (2) the transactional email system using the Resend API for purchase confirmations and test result summaries. This spec also includes the final launch checklist.

---

## 2. In-Browser Code Compiler

### 2.1 Why This Architecture?

The Judge0 API key must never be exposed to the frontend. FastAPI acts as a secure proxy — it applies per-user rate limiting and forwards code execution requests to Judge0, keeping the key server-side only.

### 2.2 Installation

```bash
# Frontend
npm install @monaco-editor/react

# Backend — no new packages; uses httpx (already installed)
```

### 2.3 Judge0 Setup

1. Sign up at [judge0.com](https://judge0.com) or use the RapidAPI hosted version
2. Get an API key from the Judge0 dashboard
3. Note the API endpoint: `https://judge0-ce.p.rapidapi.com` (RapidAPI) or your self-hosted URL

### 2.4 Backend — `backend/app/routers/compiler.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import base64
from app.config import settings
from app.dependencies.auth import get_current_user
from functools import lru_cache
from collections import defaultdict
from datetime import datetime, timedelta

router = APIRouter(prefix="/compiler", tags=["compiler"])

# Simple in-memory rate limiter: max 10 submissions per user per minute
_submissions: dict = defaultdict(list)

def _check_rate_limit(clerk_id: str):
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=1)
    _submissions[clerk_id] = [t for t in _submissions[clerk_id] if t > cutoff]
    if len(_submissions[clerk_id]) >= 10:
        raise HTTPException(status_code=429, detail="Rate limit: max 10 submissions per minute")
    _submissions[clerk_id].append(now)

# Judge0 language ID mapping
LANGUAGE_IDS = {
    "python": 71,     # Python 3.8
    "javascript": 63, # Node.js 12
    "cpp": 54,        # C++ (GCC 9)
    "java": 62,       # Java 13
    "c": 50,          # C (GCC 9)
}

class CodeSubmission(BaseModel):
    code: str
    language: str          # 'python' | 'javascript' | 'cpp' | 'java' | 'c'
    stdin: Optional[str] = ""

class ExecutionResult(BaseModel):
    stdout: Optional[str]
    stderr: Optional[str]
    compile_output: Optional[str]
    status: str            # 'Accepted' | 'Wrong Answer' | 'Runtime Error' etc.
    time: Optional[str]    # Execution time in seconds
    memory: Optional[int]  # Memory in KB

@router.post("/run", response_model=ExecutionResult)
async def run_code(
    payload: CodeSubmission,
    current_user: dict = Depends(get_current_user),
):
    """Proxies a code execution request to Judge0 API."""
    _check_rate_limit(current_user["clerk_id"])

    lang_id = LANGUAGE_IDS.get(payload.language.lower())
    if not lang_id:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {payload.language}")

    # Encode code and stdin as base64 for Judge0
    encoded_code = base64.b64encode(payload.code.encode()).decode()
    encoded_stdin = base64.b64encode((payload.stdin or "").encode()).decode()

    async with httpx.AsyncClient(timeout=30) as client:
        # Submit code to Judge0
        submit_res = await client.post(
            "https://judge0-ce.p.rapidapi.com/submissions",
            json={
                "source_code": encoded_code,
                "language_id": lang_id,
                "stdin": encoded_stdin,
                "base64_encoded": True,
                "wait": True,   # Wait for result (synchronous mode)
            },
            headers={
                "X-RapidAPI-Key": settings.JUDGE0_API_KEY,
                "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                "Content-Type": "application/json",
            },
        )
        submit_res.raise_for_status()
        result = submit_res.json()

    def decode(val: Optional[str]) -> Optional[str]:
        if val is None: return None
        try: return base64.b64decode(val).decode("utf-8", errors="replace")
        except: return val

    return ExecutionResult(
        stdout=decode(result.get("stdout")),
        stderr=decode(result.get("stderr")),
        compile_output=decode(result.get("compile_output")),
        status=result.get("status", {}).get("description", "Unknown"),
        time=result.get("time"),
        memory=result.get("memory"),
    )
```

### 2.5 Frontend — Monaco Code Editor Component

#### `frontend/src/components/CodeEditor.jsx`

```jsx
import { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useFetch } from "../hooks/useFetch";

const SUPPORTED_LANGUAGES = ["python", "javascript", "cpp", "java", "c"];
const STARTER_CODE = {
  python: '# Write your Python code here\nprint("Hello, World!")',
  javascript: '// Write your JavaScript code here\nconsole.log("Hello, World!");',
  cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  c: '#include <stdio.h>\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
};

export function CodeEditor() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE.python);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const { authFetch } = useFetch();

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCode(STARTER_CODE[lang]);
    setResult(null);
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await authFetch("/compiler/run", {
        method: "POST",
        body: JSON.stringify({ code, language, stdin }),
      });
      setResult(res);
    } catch (err) {
      setResult({ status: "Error", stderr: err.message });
    } finally {
      setRunning(false);
    }
  };

  const statusColor = {
    "Accepted": "text-green-600",
    "Runtime Error": "text-red-600",
    "Compilation Error": "text-orange-600",
    "Time Limit Exceeded": "text-yellow-600",
  }[result?.status] ?? "text-gray-700";

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
          ))}
        </select>
        <span className="flex-1" />
        <button
          onClick={handleRun}
          disabled={running}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white text-sm px-4 py-1.5 rounded font-medium transition-colors"
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          value={code}
          onChange={setCode}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
          }}
        />
      </div>

      {/* Stdin */}
      <div className="border-t border-gray-700 bg-gray-800 px-4 py-2">
        <label className="text-xs text-gray-400 block mb-1">Standard Input (stdin):</label>
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={2}
          placeholder="Enter input for your program..."
          className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1 resize-none border border-gray-600 focus:outline-none"
        />
      </div>

      {/* Output */}
      {result && (
        <div className="border-t border-gray-700 bg-gray-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Status:</span>
            <span className={`text-xs font-semibold ${statusColor}`}>{result.status}</span>
            {result.time && <span className="text-xs text-gray-500">• {result.time}s</span>}
          </div>
          {(result.stdout || result.stderr || result.compile_output) && (
            <pre className="text-xs text-gray-200 font-mono bg-gray-900 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {result.stdout || result.compile_output || result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 3. Transactional Email with Resend

### 3.1 Installation

```bash
pip install resend
```

### 3.2 Email Templates — `backend/app/services/email.py`

```python
import resend
from app.config import settings

resend.api_key = settings.RESEND_API_KEY

def send_purchase_confirmation(to_email: str, student_name: str, course_title: str, amount: str):
    """Sends a purchase confirmation email after successful enrollment."""
    resend.Emails.send({
        "from": "EdTech Platform <noreply@yourdomain.com>",
        "to": [to_email],
        "subject": f"You're enrolled in {course_title}!",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Enrollment Confirmed 🎉</h2>
          <p>Hi {student_name},</p>
          <p>You are now enrolled in <strong>{course_title}</strong>.</p>
          <p>Amount Paid: <strong>₹{amount}</strong></p>
          <p><a href="https://yourdomain.com/my-courses" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Start Learning →</a></p>
          <hr />
          <p style="color: #9ca3af; font-size: 12px;">EdTech Platform — Helping aspirants reach their goals.</p>
        </div>
        """,
    })

def send_test_result(to_email: str, student_name: str, score: float, accuracy: float, percentile: int):
    """Sends test result summary email after test submission."""
    resend.Emails.send({
        "from": "EdTech Platform <noreply@yourdomain.com>",
        "to": [to_email],
        "subject": "Your Test Results Are Ready!",
        "html": f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Test Results 📊</h2>
          <p>Hi {student_name}, here's how you did:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Score</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">{score}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Accuracy</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">{accuracy}%</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Batch Percentile</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Top {100 - percentile}%</td>
            </tr>
          </table>
          <p><a href="https://yourdomain.com/tests/results" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Detailed Analysis →</a></p>
        </div>
        """,
    })
```

### 3.3 Trigger Points

| Event | Where It's Triggered | Function Called |
|-------|---------------------|-----------------|
| Course purchase | `POST /payments/webhook` via `BackgroundTasks` | `send_purchase_confirmation()` |
| Test submission | `POST /tests/submit` via `BackgroundTasks` | `send_test_result()` |
| Admin email alert | Manual admin action or scheduled task | `send_admin_alert()` (extend as needed) |

**Usage in webhook handler (SPEC-07):**
```python
from app.services.email import send_purchase_confirmation

background_tasks.add_task(
    send_purchase_confirmation,
    to_email=student_email,        # Fetch from Clerk API using clerk_id
    student_name=student_name,
    course_title=course.title,
    amount=str(course.price),
)
```

---

## 4. Production Launch Checklist

### Pre-Launch

- [ ] All GitHub Actions CI checks are green
- [ ] `RESEND_API_KEY` verified with a test email
- [ ] `JUDGE0_API_KEY` verified with a test code submission
- [ ] Razorpay switched to **Live** mode (update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`)
- [ ] Clerk switched to **Production** instance (update `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`)
- [ ] All Render environment variables updated with production values
- [ ] Vercel domain configured (custom domain + SSL)
- [ ] Redis (Upstash) connected and cache warm
- [ ] `cron-job.org` keep-alive ping active for Render backend

### End-to-End Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Student signs up via Google | Redirected to dashboard with role=student |
| Student purchases a course | Enrollment created; confirmation email received |
| Student accesses unpurchased content | `403 Forbidden` |
| Teacher uploads video | HLS stream available within seconds via ImageKit |
| Student watches 90% of video | Lesson marked complete; DPP unlocks |
| Student submits mock test | Score and analytics available immediately |
| Student bookmarks video timestamp | Seeks to that position on click |
| Code submission (Python) | Output appears within 3 seconds |

---

## 5. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/compiler/run` | JWT | Execute code via Judge0 proxy |

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Week 9 Day 1–2 | Get Judge0 API key. Write `compiler.py` router with rate limiter. Test Python execution in Swagger. |
| Week 9 Day 3–4 | Build Monaco Editor component with language selector, stdin, and output panel. |
| Week 9 Day 5 | Test code compilation for all supported languages. |
| Week 10 Day 1–2 | Write `email.py` service. Connect purchase confirmation to Razorpay webhook handler. |
| Week 10 Day 3 | Connect test result email to `POST /tests/submit`. |
| Week 10 Day 4–5 | Full end-to-end QA on all scenarios. Fix any bugs found. |
| Week 10 Day 6–7 | Switch Razorpay and Clerk to production. Deploy. Monitor logs. 🚀 |

---

## 7. Acceptance Criteria

- [ ] Monaco Editor loads with syntax highlighting for all 5 supported languages
- [ ] Python code `print("Hello")` returns `stdout: "Hello\n"` within 3 seconds
- [ ] Rate limiter rejects the 11th submission within 1 minute with `429`
- [ ] Purchase confirmation email is delivered to student after payment
- [ ] Test result email includes correct score and percentile
- [ ] All end-to-end test scenarios pass in production

---

## 8. Environment Variables Introduced

```env
# Backend .env
JUDGE0_API_KEY=your_rapidapi_key
```
