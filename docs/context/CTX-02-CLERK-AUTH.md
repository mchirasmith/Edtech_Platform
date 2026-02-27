# Agent Context — SPEC-02: Clerk Authentication & RBAC

## Your Task
Wire up Clerk authentication across the entire stack. Frontend gets `<ClerkProvider>`, sign-in/sign-up pages, a `ProtectedRoute` component, and a role-aware dashboard router. Backend gets a JWT verification FastAPI dependency, role guards, and a Clerk webhook handler that sets `role: student` on `user.created`.

## Pre-Conditions
- SPEC-01 complete: FastAPI and Vite apps are running
- Clerk account created at [clerk.com](https://clerk.com)
- Google OAuth enabled in Clerk Dashboard → Social Connections

## Roles
| Value | Who | Can access |
|-------|-----|-----------|
| `student` (default) | Buyers | Enrolled content only |
| `teacher` | Instructors | Create/edit courses, lessons, tests |
| `admin` | Platform ops | Everything including user management |

Roles live in Clerk `publicMetadata.role` — **never in Supabase**.

## Files to Create / Modify

### `backend/app/dependencies/auth.py` ← MOST IMPORTANT
```python
from jose import jwt, JWTError
from fastapi.security import HTTPBearer
from functools import lru_cache
import httpx

security = HTTPBearer()

@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    url = f"https://{settings.CLERK_DOMAIN}/.well-known/jwks.json"
    return httpx.get(url, timeout=10).json()

def get_current_user(credentials = Depends(security)) -> dict:
    # decode JWT with RS256, options={"verify_aud": False}
    # return {"clerk_id": payload["sub"], "role": payload.get("publicMetadata",{}).get("role","student")}
    # raise HTTP 401 on JWTError

def require_role(*roles):
    # Factory: returns a dependency checking current_user["role"] is in roles
    # raise HTTP 403 if not

# Convenience:
require_teacher = require_role("teacher", "admin")
require_admin   = require_role("admin")
```

### `backend/app/routers/clerk_webhooks.py`
- `POST /webhooks/clerk` — no auth (Svix signature instead)
- Verify with `Webhook(settings.CLERK_WEBHOOK_SECRET).verify(payload, headers)` from `svix`
- On `user.created`: PATCH Clerk API to set `publicMetadata: {role: "student"}`

### `frontend/src/main.jsx`
Wrap `<App>` in `<BrowserRouter>` then `<ClerkProvider publishableKey={...}>`.

### `frontend/src/pages/SignInPage.jsx` + `SignUpPage.jsx`
Use `<SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />` etc.

### `frontend/src/components/ProtectedRoute.jsx`
```jsx
const { isSignedIn, isLoaded, user } = useUser();
// Show spinner if !isLoaded
// Redirect to /sign-in if !isSignedIn
// Redirect to /unauthorized if requiredRole && role !== requiredRole
```

### `frontend/src/pages/Dashboard.jsx`
Read `user?.publicMetadata?.role` → render `<AdminDashboard>`, `<TeacherDashboard>`, or `<StudentDashboard>`.

### `frontend/src/hooks/useFetch.js`
```js
const { getToken } = useAuth();
const authFetch = async (url, options = {}) => {
  const token = await getToken();
  // fetch with Authorization: Bearer {token}
};
return { authFetch };
```

## Clerk Dashboard Actions Required
1. **Webhooks → Add Endpoint**: URL = `https://your-api.onrender.com/webhooks/clerk`
2. **Subscribe to**: `user.created`
3. **Copy signing secret** → `CLERK_WEBHOOK_SECRET` in `.env`

## API Endpoint to Add
```
GET /auth/me → { clerk_id, role }   (requires get_current_user)
```
Register `clerk_webhooks.router` in `main.py`.

## Environment Variables
```env
# frontend/.env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# backend/.env
CLERK_SECRET_KEY=sk_test_...
CLERK_DOMAIN=your-app.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...
```

## Done When
- [ ] New sign-up gets `role: student` set automatically via webhook
- [ ] `GET /auth/me` returns `{clerk_id, role}` with a valid JWT
- [ ] `GET /auth/me` returns `401` with no/expired token
- [ ] Teacher-only endpoint returns `403` for student JWT
- [ ] Google OAuth sign-in works end-to-end
- [ ] Unauthenticated `/dashboard` redirects to `/sign-in`

## Read Next
Full code: `docs/specs/SPEC-02-CLERK-AUTH.md`
