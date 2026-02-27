# SPEC-02 — Clerk Authentication & RBAC

| Field | Value |
|-------|-------|
| **Module** | Clerk Auth + JWT Verification + Role Management |
| **Phase** | Phase 1 |
| **Week** | Week 1 (Days 3–7) |
| **PRD Refs** | AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06 |
| **Depends On** | SPEC-01 (Project Setup) |

---

## 1. Overview

Clerk replaces all custom authentication logic. This module wires up the Clerk React SDK on the frontend (wrapping the app, protected routes, role-based rendering), configures FastAPI to verify Clerk-issued JWTs on the backend using Clerk's public JWKS endpoint, and registers a Clerk `user.created` webhook to set the initial user role in Clerk's `publicMetadata`.

---

## 2. Roles

| Role | Who | Access |
|------|-----|--------|
| `student` | Paying students | Read-only access to enrolled content |
| `teacher` | Subject matter experts | Create/edit courses, lessons, tests |
| `admin` | Platform operations | Full access including user management |

Roles are stored in Clerk's `publicMetadata.role` — **not** in Supabase. FastAPI reads the role from the decoded JWT on every request.

---

## 3. Installation

```bash
# Frontend
npm install @clerk/clerk-react

# Backend
pip install python-jose[cryptography] httpx svix
```

---

## 4. Frontend Implementation

### 4.1 ClerkProvider — `frontend/src/main.jsx`

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error("Missing Clerk publishable key");

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </BrowserRouter>
);
```

### 4.2 Auth Pages — `frontend/src/pages/`

```jsx
// pages/SignInPage.jsx
import { SignIn } from "@clerk/clerk-react";
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />
    </div>
  );
}

// pages/SignUpPage.jsx
import { SignUp } from "@clerk/clerk-react";
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp routing="path" path="/sign-up" afterSignUpUrl="/dashboard" />
    </div>
  );
}
```

### 4.3 Route Protection — `frontend/src/components/ProtectedRoute.jsx`

```jsx
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ children, requiredRole = null }) {
  const { isSignedIn, isLoaded, user } = useUser();

  if (!isLoaded) return <div className="spinner" />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;

  const role = user?.publicMetadata?.role;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
```

**Usage in `App.jsx`:**
```jsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
<Route path="/teacher" element={
  <ProtectedRoute requiredRole="teacher">
    <TeacherDashboard />
  </ProtectedRoute>
} />
```

### 4.4 Auth Fetch Hook — `frontend/src/hooks/useFetch.js`

```jsx
import { useAuth } from "@clerk/clerk-react";

export function useFetch() {
  const { getToken } = useAuth();

  const authFetch = async (url, options = {}) => {
    const token = await getToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  };

  return { authFetch };
}
```

### 4.5 Role-Based Dashboard Routing — `frontend/src/pages/Dashboard.jsx`

```jsx
import { useUser } from "@clerk/clerk-react";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import AdminDashboard from "./AdminDashboard";

export default function Dashboard() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role ?? "student";

  if (role === "admin") return <AdminDashboard />;
  if (role === "teacher") return <TeacherDashboard />;
  return <StudentDashboard />;
}
```

---

## 5. Backend Implementation

### 5.1 JWT Verification Dependency — `backend/app/dependencies/auth.py`

```python
import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import lru_cache
from app.config import settings

security = HTTPBearer()

@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetches and in-process caches Clerk's JWKS public keys. Re-fetched on restart."""
    url = f"https://{settings.CLERK_DOMAIN}/.well-known/jwks.json"
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return response.json()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            _get_jwks(),
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        clerk_id: str = payload["sub"]                                    # e.g. "user_2abc123"
        role: str = payload.get("publicMetadata", {}).get("role", "student")
        return {"clerk_id": clerk_id, "role": role}
    except (JWTError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(*roles: str):
    """Factory: returns a dependency that enforces specific roles."""
    def _check(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _check

# Convenience aliases
require_teacher = require_role("teacher", "admin")
require_admin = require_role("admin")
```

### 5.2 Clerk Webhook — `backend/app/routers/clerk_webhooks.py`

```python
from fastapi import APIRouter, Request, HTTPException
import httpx
from svix.webhooks import Webhook
from app.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/clerk")
async def handle_clerk_webhook(request: Request):
    payload = await request.body()
    headers = dict(request.headers)

    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
    try:
        event = wh.verify(payload, headers)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type")
    if event_type == "user.created":
        user_id = event["data"]["id"]
        # Set default role to 'student' in Clerk publicMetadata
        httpx.patch(
            f"https://api.clerk.com/v1/users/{user_id}/metadata",
            json={"public_metadata": {"role": "student"}},
            headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
        )

    return {"received": True}
```

> **Register in `main.py`**: `app.include_router(clerk_webhooks.router)`
>
> **Clerk Dashboard setup**: Go to **Webhooks → Add Endpoint** → enter `https://your-api.onrender.com/webhooks/clerk` → subscribe to `user.created` event → copy the signing secret to `CLERK_WEBHOOK_SECRET`.

---

## 6. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/webhooks/clerk` | None (Svix signature) | Receives user.created; sets role=student |
| `GET` | `/auth/me` | Clerk JWT | Returns current user's clerk_id and role |

**`GET /auth/me`:**
```python
@router.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
```

---

## 7. Frontend Routes

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/sign-in` | `SignInPage` | No |
| `/sign-up` | `SignUpPage` | No |
| `/dashboard` | `Dashboard` | Yes (any role) |
| `/teacher/*` | Teacher pages | Yes (teacher/admin) |
| `/admin/*` | Admin pages | Yes (admin only) |

---

## 8. Implementation Steps

| Day | Task |
|-----|------|
| Day 3 | Create Clerk account. Set publishable + secret keys in `.env.local` and `.env`. Wrap app with `<ClerkProvider>`. Add sign-in/sign-up pages. |
| Day 4 | Enable Google OAuth in Clerk Dashboard under Social Connections. Test sign-in flow end-to-end. |
| Day 5 | Write `ProtectedRoute` component. Implement role-based `Dashboard` routing. |
| Day 6 | Write FastAPI `get_current_user` dependency. Register Clerk webhook. Test JWT verification with a real token. |
| Day 7 | Write `require_teacher` / `require_admin` role guards. Add `GET /auth/me` endpoint. Write `pytest` tests for auth dependency. |

---

## 9. Acceptance Criteria

- [ ] Unauthenticated users are redirected to `/sign-in` when accessing protected routes
- [ ] Google OAuth sign-in works end-to-end
- [ ] A new sign-up automatically gets `role: student` in Clerk `publicMetadata` via webhook
- [ ] `GET /auth/me` returns `{ clerk_id, role }` when a valid Clerk JWT is supplied
- [ ] `GET /auth/me` returns `401` when no token or an expired token is supplied
- [ ] Teacher-only endpoints return `403` when called by a student JWT
- [ ] CI tests for `get_current_user` pass

---

## 10. Environment Variables Introduced

```env
# Frontend .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Backend .env
CLERK_SECRET_KEY=sk_test_...
CLERK_DOMAIN=your-app.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...
```
