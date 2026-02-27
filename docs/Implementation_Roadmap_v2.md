# EdTech Platform
## Updated Implementation Roadmap v2
*Stack: Clerk | Supabase | Razorpay | ImageKit.io | React + Vite + FastAPI*

---

# 1. Updated Tech Stack at a Glance

| Category | Previous Plan | Updated Stack (v2) |
| :--- | :--- | :--- |
| Authentication | JWT (custom) + Google OAuth (manual) | ✅ **Clerk** — handles JWTs, sessions, social logins, RBAC |
| Backend | FastAPI (Python) | **FastAPI (Python)** — unchanged |
| Database | PostgreSQL on Neon.tech + SQLAlchemy | ✅ **Supabase** (hosted PostgreSQL) + SQLAlchemy |
| Payment Gateway | Razorpay | ✅ **Razorpay** — unchanged |
| Frontend | React + Vite + Tailwind CSS | **React + Vite + Tailwind CSS** — unchanged |
| Real-time | FastAPI WebSockets | **FastAPI WebSockets** — unchanged |
| **Media (Video + Audio)** | Cloudinary / Mux | ✅ **ImageKit.io** — HLS streaming, audio CDN, signed URLs |
| File Storage (PDFs/Images) | Supabase Storage | **Supabase Storage** — unchanged |
| Hosting | Render + Vercel + Neon.tech | Render + Vercel + Supabase |

---

# 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    React + Vite (Vercel)                             │
│  @clerk/clerk-react  │  imagekitio-react  │  Razorpay Checkout JS   │
└────────────┬─────────────────────────────────────────────────────────┘
             │ REST / WebSocket  (Clerk JWT in Authorization header)
┌────────────▼─────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Render)                         │
│  get_current_user (Clerk JWKS)  │  Razorpay SDK  │  ImageKit SDK    │
│  SQLAlchemy ORM  │  BackgroundTasks (Resend)                        │
└────────┬──────────────────────────┬──────────────────────────────────┘
         │                          │
┌────────▼────────────┐  ┌──────────▼─────────────────────────────────┐
│ Supabase PostgreSQL │  │  ImageKit.io CDN                            │
│  All business data  │  │  Video (HLS) + Audio + Thumbnails           │
└─────────────────────┘  └─────────────────────────────────────────────┘
```

---

# 3. External SDK Implementation Guide

## 3.1 Clerk — Authentication & RBAC

### Why Clerk?
Clerk replaces every auth concern — password hashing, JWT signing, session management, social logins, and RBAC metadata — with a single SDK. You write zero auth-plumbing code.

### Installation

```bash
# Frontend
npm install @clerk/clerk-react

# Backend
pip install python-jose[cryptography] httpx
```

### Frontend Setup

**1. Wrap your app with `ClerkProvider`** (`main.jsx`):

```jsx
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>
);
```

**2. Pre-built auth UI** — drop these anywhere:

```jsx
import { SignIn, SignUp } from "@clerk/clerk-react";

// Dedicated pages — Clerk handles all the UI, validation, and error states
<Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
<Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} />
```

**3. Protect routes and read user context:**

```jsx
import { useUser, useAuth, RedirectToSignIn } from "@clerk/clerk-react";

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <Spinner />;
  return isSignedIn ? children : <RedirectToSignIn />;
}

function Dashboard() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role; // 'student' | 'teacher' | 'admin'

  return role === "teacher" ? <TeacherDashboard /> : <StudentDashboard />;
}
```

**4. Attach the Clerk JWT to every API request:**

```jsx
import { useAuth } from "@clerk/clerk-react";

function useFetch() {
  const { getToken } = useAuth();

  const authFetch = async (url, options = {}) => {
    const token = await getToken(); // Short-lived JWT from Clerk session
    return fetch(`${import.meta.env.VITE_API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };

  return { authFetch };
}
```

### Backend Setup (FastAPI JWT Verification)

FastAPI verifies the Clerk-issued JWT on every protected route — it never issues its own tokens.

```python
# dependencies/auth.py
import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import lru_cache
from app.config import settings

security = HTTPBearer()

@lru_cache(maxsize=1)
def get_clerk_jwks():
    """Fetches and caches Clerk's public JWKS keys."""
    res = httpx.get(f"https://{settings.CLERK_DOMAIN}/.well-known/jwks.json")
    return res.json()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        jwks = get_clerk_jwks()
        # python-jose decodes and verifies the JWT against Clerk's public keys
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        clerk_id: str = payload.get("sub")       # e.g. "user_2abc123"
        role: str = payload.get("publicMetadata", {}).get("role", "student")
        if clerk_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return {"clerk_id": clerk_id, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

# Usage on any protected route:
@router.get("/courses")
def list_courses(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(Course).all()
```

### RBAC — Setting User Roles via Clerk Webhook

When a new user signs up, Clerk fires a `user.created` webhook to your FastAPI backend. Use this to set the initial role:

```python
# routers/clerk_webhooks.py
from fastapi import Request, HTTPException
import httpx
from svix.webhooks import Webhook  # pip install svix

@router.post("/webhooks/clerk")
async def clerk_webhook(request: Request):
    payload = await request.body()
    headers = dict(request.headers)

    # Verify the webhook signature using the Clerk signing secret
    wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
    try:
        event = wh.verify(payload, headers)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "user.created":
        clerk_user_id = event["data"]["id"]
        # Set default role = 'student' in Clerk's publicMetadata
        httpx.patch(
            f"https://api.clerk.com/v1/users/{clerk_user_id}/metadata",
            json={"public_metadata": {"role": "student"}},
            headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
        )
    return {"status": "ok"}
```

> **Google OAuth**: No backend code needed. Enable it in the Clerk Dashboard under **"Social Connections" → Google**. Clerk handles the OAuth flow entirely.

---

## 3.2 Supabase — PostgreSQL Database

### Why Supabase?
Supabase is used purely as a **managed PostgreSQL host**. FastAPI connects to it with a standard SQLAlchemy connection string — you get a better dashboard, no 90-day data expiry, and built-in Storage for PDFs.

### Installation

```bash
pip install sqlalchemy psycopg2-binary alembic
```

### FastAPI Database Connection

```python
# database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Supabase gives you this URL from: Project Settings → Database → Connection String
engine = create_engine(
    settings.DATABASE_URL,          # postgres://postgres:[password]@[host]:5432/postgres
    pool_pre_ping=True,             # Detect stale connections
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### SQLAlchemy Models

```python
# models.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    teacher_clerk_id = Column(String, nullable=False)   # Clerk user ID (e.g. "user_2abc123")
    price = Column(Numeric(10, 2), nullable=False)
    thumbnail_path = Column(String)                      # Supabase Storage path
    created_at = Column(DateTime, default=datetime.utcnow)
    lessons = relationship("Lesson", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course")

class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, nullable=False)
    media_type = Column(String)                         # 'video' | 'audio' | 'pdf'
    imagekit_file_id = Column(String)                   # ImageKit file ID
    imagekit_path = Column(String)                      # e.g. /edtech/courses/1/lessons/2/video.mp4
    course = relationship("Course", back_populates="lessons")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_clerk_id = Column(String, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    course = relationship("Course", back_populates="enrollments")

class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    name = Column(String, nullable=False)
    start_date = Column(DateTime)

class DoubtMessage(Base):
    __tablename__ = "doubt_messages"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    sender_clerk_id = Column(String, nullable=False)
    content = Column(Text)
    audio_imagekit_path = Column(String)                # Optional voice note via ImageKit
    sent_at = Column(DateTime, default=datetime.utcnow)

class Bookmark(Base):
    __tablename__ = "bookmarks"
    id = Column(Integer, primary_key=True, index=True)
    student_clerk_id = Column(String, nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    timestamp_seconds = Column(Integer, nullable=False)  # Video seek point
    label = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Alembic Migrations

```bash
# Initialize Alembic once
alembic init alembic

# Create a new migration after changing models
alembic revision --autogenerate -m "initial schema"

# Apply migrations to Supabase PostgreSQL
alembic upgrade head
```

### Supabase Storage (for PDFs and course thumbnails)

```python
# Supabase Storage is accessed via the supabase-py client for file uploads
# pip install supabase
from supabase import create_client

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def upload_pdf(file_bytes: bytes, destination_path: str) -> str:
    """Uploads a PDF to Supabase Storage and returns the public URL."""
    supabase.storage.from_("dpp-files").upload(
        path=destination_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf"},
    )
    return supabase.storage.from_("dpp-files").get_public_url(destination_path)
```

---

## 3.3 Razorpay — Payments

### Why Razorpay?
Razorpay is India's leading payment gateway. It handles UPI, cards, net banking, and wallets. The architecture is: FastAPI creates an order server-side → React opens the checkout modal → Razorpay sends a webhook to FastAPI on payment success → FastAPI verifies the signature and creates the enrollment.

### Installation

```bash
# Backend
pip install razorpay

# Frontend — add via CDN in index.html (no npm package needed)
# <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Backend — Order Creation

```python
# routers/payments.py
import razorpay
from fastapi import APIRouter, Depends, HTTPException
from app.config import settings
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)

@router.post("/create-order")
def create_order(course_id: int, db: Session = Depends(get_db),
                 current_user=Depends(get_current_user)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Amount must be in paise (multiply INR by 100)
    order = client.order.create({
        "amount": int(course.price * 100),
        "currency": "INR",
        "receipt": f"order_course_{course_id}_user_{current_user['clerk_id']}",
        "notes": {
            "course_id": str(course_id),
            "clerk_id": current_user["clerk_id"],
        },
    })
    return {"order_id": order["id"], "amount": order["amount"], "currency": order["currency"]}
```

### Frontend — Checkout Modal

```jsx
// components/BuyButton.jsx
import { useAuth } from "@clerk/clerk-react";

export function BuyButton({ courseId, courseName, price }) {
  const { getToken } = useAuth();

  const handleBuy = async () => {
    const token = await getToken();

    // 1. Create Razorpay order via FastAPI
    const res = await fetch(`${import.meta.env.VITE_API_URL}/payments/create-order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId }),
    });
    const { order_id, amount } = await res.json();

    // 2. Open Razorpay checkout modal
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount,
      currency: "INR",
      name: "EdTech Platform",
      description: courseName,
      order_id,
      handler: async (response) => {
        // 3. After payment success, Razorpay fires a webhook to FastAPI automatically
        // Optionally notify the UI here
        alert("Payment successful! Enrollment confirmed.");
        window.location.href = "/my-courses";
      },
      prefill: { name: "", email: "", contact: "" }, // Clerk fills this if needed
      theme: { color: "#6366f1" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <button onClick={handleBuy} className="btn-buy">
      Buy Now — ₹{price}
    </button>
  );
}
```

### Backend — Webhook Handler (Signature Verification)

This is the most critical security step — always verify the Razorpay signature before granting access.

```python
# routers/payments.py (continued)
import hmac
import hashlib
from fastapi import Request, BackgroundTasks

@router.post("/webhook")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks,
                           db: Session = Depends(get_db)):
    payload = await request.body()
    received_signature = request.headers.get("X-Razorpay-Signature")

    # Step 1: Verify HMAC-SHA256 signature (NEVER skip this)
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received_signature, expected_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Step 2: Parse event
    event = await request.json()
    if event["event"] == "payment.captured":
        notes = event["payload"]["payment"]["entity"]["notes"]
        course_id = int(notes["course_id"])
        clerk_id = notes["clerk_id"]

        # Step 3: Create enrollment
        enrollment = Enrollment(
            student_clerk_id=clerk_id,
            course_id=course_id,
        )
        db.add(enrollment)
        db.commit()

        # Step 4: Send confirmation email in background (non-blocking)
        background_tasks.add_task(send_purchase_email, clerk_id, course_id)

    return {"status": "ok"}
```

---

## 3.4 ImageKit.io — Video, Audio & Image CDN

### Why ImageKit.io?
ImageKit replaces Cloudinary and Mux. It handles video HLS transcoding, audio CDN delivery, image transformations, and access control via signed URLs — all from a single SDK.

### Installation

```bash
# Frontend
npm install imagekitio-react

# Backend
pip install imagekitio
```

### Frontend — Direct Upload (Teacher Dashboard)

```jsx
import { IKContext, IKUpload, IKImage } from "imagekitio-react";
import { useAuth } from "@clerk/clerk-react";

export function MediaUploader({ courseId, lessonId, onUploadSuccess }) {
  const { getToken } = useAuth();

  // Fetches a short-lived upload signature from FastAPI
  const authenticator = async () => {
    const token = await getToken();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/media/auth`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json(); // { token, expire, signature }
  };

  return (
    <IKContext
      publicKey={import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY}
      urlEndpoint={import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT}
      authenticator={authenticator}
    >
      <IKUpload
        folder={`/edtech/courses/${courseId}/lessons/${lessonId}/`}
        accept="video/*,audio/*"
        onSuccess={(res) => onUploadSuccess(res.fileId, res.filePath)}
        onError={(err) => console.error("Upload failed:", err)}
      />

      {/* Display existing thumbnail using ImageKit URL transforms */}
      <IKImage
        path={`/edtech/courses/${courseId}/thumbnail.jpg`}
        transformation={[{ width: 400, height: 225, cropMode: "extract" }]}
        alt="Course thumbnail"
      />
    </IKContext>
  );
}
```

### Backend — Upload Auth Endpoint + Signed URLs

```python
# routers/media.py
from imagekitio import ImageKit
from app.config import settings
from app.dependencies.auth import get_current_user

imagekit = ImageKit(
    private_key=settings.IMAGEKIT_PRIVATE_KEY,
    public_key=settings.IMAGEKIT_PUBLIC_KEY,
    url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
)

@router.get("/media/auth")
def get_imagekit_auth(current_user=Depends(get_current_user)):
    """Returns a temporary upload signature for the frontend IKUpload component."""
    if current_user["role"] not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers can upload media")
    auth_params = imagekit.get_authentication_parameters()
    return auth_params  # { token, expire, signature }

@router.get("/lessons/{lesson_id}/stream-url")
def get_stream_url(lesson_id: int, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404)

    # Verify the student is enrolled before issuing a signed URL
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.course_id == lesson.course_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Purchase this course to access content")

    # Generate a time-limited signed URL (expires in 1 hour)
    signed_url = imagekit.url({
        "path": lesson.imagekit_path,
        "signed": True,
        "expire_seconds": 3600,
    })
    return {"url": signed_url, "media_type": lesson.media_type}
```

### Frontend — Video & Audio Player

```jsx
import ReactPlayer from "react-player";    // npm install react-player
import { useEffect, useState } from "react";

export function LessonPlayer({ lessonId }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const { authFetch } = useFetch();
  const playerRef = useRef(null);

  useEffect(() => {
    authFetch(`/lessons/${lessonId}/stream-url`)
      .then((r) => r.json())
      .then(({ url, media_type }) => {
        setStreamUrl(url);
        setMediaType(media_type);
      });
  }, [lessonId]);

  if (!streamUrl) return <Spinner />;

  return mediaType === "audio" ? (
    <ReactPlayer url={streamUrl} controls height="60px" width="100%" />
  ) : (
    // ImageKit auto-generates HLS (.m3u8) — ReactPlayer handles it natively
    <ReactPlayer ref={playerRef} url={streamUrl} controls width="100%" />
  );
}
```

### ImageKit URL Transformations (Zero Extra Storage)

```js
// Auto-generated video thumbnail at 5-second mark — no extra upload needed
const thumbnailUrl = `${IK_ENDPOINT}/edtech/courses/1/lessons/2/video.mp4?tr=so-5,w-640,h-360`;

// Compress audio to 96kbps for mobile
const audioUrl = `${IK_ENDPOINT}/edtech/lessons/3/audio.mp3?tr=q-96`;

// Responsive image thumbnail
const imgUrl = `${IK_ENDPOINT}/edtech/courses/1/thumbnail.jpg?tr=w-400,h-225,cm-extract`;
```

---

# 4. Week-by-Week Implementation Plan

## Phase 1: Core Foundation (Weeks 1–4)

### Week 1: Project Setup + Clerk Authentication

**Days 1–2**: Initialize Vite/React and FastAPI. Connect FastAPI to Supabase via `DATABASE_URL`. Set up SQLAlchemy models and run `alembic upgrade head`.

**Days 3–4**: Install `@clerk/clerk-react`. Wrap app with `<ClerkProvider>`. Add `<SignIn />` and `<SignUp />` routes. Enable Google OAuth in the Clerk Dashboard.

**Days 5–6**: Implement RBAC. Register the Clerk `user.created` webhook endpoint in FastAPI. Set `role: 'student'` by default. Use `useUser()` to render role-specific dashboards.

**Day 7**: Write the FastAPI `get_current_user` dependency. Test protected routes by passing a Clerk JWT from the frontend.

---

### Week 2: Database Schema + Course Management

**Days 1–2**: Create all SQLAlchemy models. Run Alembic migrations against Supabase PostgreSQL.

**Days 3–4**: FastAPI CRUD for `courses` and `lessons`. All endpoints protected by `get_current_user`. Teacher-only routes check `role == 'teacher'`.

**Days 5–6**: Teacher Dashboard UI in React. All API calls via the `authFetch` helper (Clerk JWT attached automatically).

**Day 7**: Student Catalog — React page that fetches and renders available courses from FastAPI.

---

### Week 3: Media Delivery Pipeline (ImageKit.io)

**Days 1–2**: Create ImageKit account. Get Public Key, Private Key, URL Endpoint. Set up folder structure in the ImageKit dashboard.

**Day 3**: FastAPI `/media/auth` endpoint (upload signature) and `/lessons/{id}/stream-url` (signed URL generation).

**Days 4–5**: Teacher Dashboard upload UI using `IKContext` + `IKUpload`. On success, persist `imagekit_file_id` and `imagekit_path` to the `lessons` table.

**Days 6–7**: Student `LessonPlayer` component with `react-player`. Test full upload → stream → seek flow.

---

### Week 4: Razorpay Commerce Layer

**Days 1–2**: FastAPI `POST /payments/create-order` endpoint using the Razorpay Python SDK.

**Days 3–4**: React `BuyButton` component. Opens Razorpay checkout modal with the `order_id` from FastAPI.

**Days 5–6**: FastAPI `POST /payments/webhook`. HMAC-SHA256 signature verification. On `payment.captured`, insert into `enrollments` and send confirmation email via `BackgroundTasks`.

**Day 7**: "My Courses" page — FastAPI queries enrollments by `clerk_id`. Test the complete payment → enrollment → media access flow.

---

## Phase 2: Engagement & Competitor Standards (Weeks 5–6)

### Week 5: Batch Cohorts + Real-Time Doubt Chat (with Audio Notes)

**Days 1–3**: Add `batch_id` to `enrollments`. All content queries filtered by `batch_id`. Build the "My Batch" React page.

**Days 4–7**: FastAPI WebSocket endpoint for real-time doubt chat, grouped by `batch_id`. Messages persisted to `doubt_messages` via SQLAlchemy.

> **Audio voice notes**: Teachers and students can attach voice notes to doubt messages — using the same `IKUpload` flow from Week 3. The `audio_imagekit_path` is stored in `doubt_messages` and rendered with a small `<ReactPlayer />`.

---

### Week 6: Assessment Engine (CBT Mock Tests)

**Days 1–3**: React CBT interface — question palette, "Mark for Review" state, countdown timer (`useEffect`), auto-submit on timeout.

**Days 4–5**: FastAPI answer evaluation endpoint. Compare answers against `test_questions`, calculate score with positive/negative marking, write result to `test_attempts`.

**Days 6–7**: Post-test analytics dashboard using Recharts. Accuracy per subject, time-per-question, batch-average comparison.

---

## Phase 3: Production Polish (Weeks 7–10)

### Week 7: Caching, CI/CD & Performance

- Redis + `fastapi-cache2` for course catalog and batch listing endpoints.
- ImageKit CDN serves all media with automatic cache-control headers.
- GitHub Actions: lint → `pytest` → deploy FastAPI to Render + React to Vercel on every push to `main`.

---

### Week 8: Academic Edge — KaTeX + Video Bookmarks

- `react-katex` in doubt chat and test components for LaTeX rendering.
- Video bookmarks: `useRef` on `react-player` to capture `currentTime`. Save to `bookmarks` table. Render as clickable list that seeks the player.
- ImageKit auto-generated thumbnails via URL params (`?tr=so-5`) — no extra storage.

---

### Week 9: In-Browser Code Compiler

- Monaco Editor (`@monaco-editor/react`) for VS Code-like coding experience.
- FastAPI secure proxy to Judge0 API — keeps the API key off the frontend.

---

### Week 10: Email Notifications & Launch

- Transactional emails via FastAPI `BackgroundTasks` + Resend API (purchase confirmations, test result summaries).
- Clerk handles all auth emails (OTP, magic-link) out of the box.
- Final end-to-end QA, performance audits, production launch.

---

# 5. Environment Variables

### React Frontend (`.env.local`)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=https://your-api.onrender.com
VITE_RAZORPAY_KEY_ID=rzp_test_...
VITE_IMAGEKIT_PUBLIC_KEY=public_...
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
```

### FastAPI Backend (`.env` / Render environment variables)

```env
# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_DOMAIN=your-clerk-app.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
DATABASE_URL=postgres://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # For Supabase Storage uploads (server-side only)

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# ImageKit
IMAGEKIT_PRIVATE_KEY=private_...
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id

# Other
RESEND_API_KEY=re_...
REDIS_URL=redis://...
```

---

# 6. Milestone Summary

| Week | Milestone | Deliverable |
| :--- | :--- | :--- |
| **1** | **Auth Live** | Clerk login/signup; Google OAuth; roles set via webhook; FastAPI JWT verification |
| **2** | **Database Live** | Supabase tables migrated; teacher CRUD for courses/lessons; student catalog |
| **3** | **Media Live** | ImageKit direct upload; HLS video + audio streaming via signed URLs |
| **4** | **Payments Live** | Razorpay order → checkout modal → webhook → enrollment end-to-end |
| **5** | **Batches + Chat Live** | Batch cohort isolation; real-time doubt chat with audio note support |
| **6** | **Mock Tests Live** | CBT UI with timer + auto-submit; scoring engine; post-test analytics |
| **7** | **CI/CD + Caching Live** | GitHub Actions pipeline; Redis caching; ImageKit CDN for all media |
| **8** | **Academic Tools Live** | KaTeX rendering; video bookmarks; auto-generated thumbnails |
| **9** | **Code Compiler Live** | Monaco Editor + Judge0 API sandboxed code execution |
| **10** | **Launch Ready** | Transactional emails; end-to-end QA; performance audit; production launch |

---

*Stack: Clerk + Supabase + Razorpay + ImageKit.io + React/Vite + FastAPI*
