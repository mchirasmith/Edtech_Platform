# SPEC-07 — Razorpay Payment Gateway

| Field | Value |
|-------|-------|
| **Module** | Razorpay — Order Creation, Checkout Modal, Webhook, Enrollment |
| **Phase** | Phase 1 |
| **Week** | Week 4 (Days 1–6) |
| **PRD Refs** | PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07 |
| **Depends On** | SPEC-02 (Clerk Auth), SPEC-03 (DB Schema), SPEC-04 (Course Management) |

---

## 1. Overview

This spec covers the complete Razorpay payment flow: FastAPI server-side order creation, the React checkout modal, the HMAC-SHA256 signed webhook handler that grants enrollment on `payment.captured`, webhook idempotency guard, and the background task for purchase confirmation emails. This is the most security-critical module — the webhook signature must always be verified before any database write.

---

## 2. Installation

```bash
# Backend
pip install razorpay resend

# Frontend — add to index.html (no npm package)
# <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## 3. Backend — `backend/app/routers/payments.py`

```python
import hmac
import hashlib
import razorpay
import resend
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.config import settings
from app.dependencies.auth import get_current_user
from app.models.course import Course
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/payments", tags=["payments"])

# Initialize Razorpay client once (thread-safe)
rzp_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)

# ── Order Creation ────────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    course_id: int

@router.post("/create-order")
def create_order(
    payload: OrderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Creates a Razorpay order server-side and returns order_id to the frontend."""
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Prevent duplicate purchase
    existing = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.course_id == payload.course_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled in this course")

    # Amount in paise (1 INR = 100 paise)
    order = rzp_client.order.create({
        "amount": int(course.price * 100),
        "currency": "INR",
        "receipt": f"rc_{payload.course_id}_{current_user['clerk_id'][:8]}",
        "notes": {
            "course_id": str(payload.course_id),
            "clerk_id": current_user["clerk_id"],
        },
    })

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "course_title": course.title,
    }

# ── Webhook Handler ───────────────────────────────────────────────────────────

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Receives Razorpay payment events. Verifies HMAC-SHA256 signature before any DB write.
    This endpoint must remain unauthenticated (no Clerk JWT) — Razorpay calls it directly.
    """
    raw_body = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "")

    # ── STEP 1: Verify signature (NEVER skip) ────────────────────────────────
    expected_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received_sig, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # ── STEP 2: Parse event ──────────────────────────────────────────────────
    event = await request.json()

    if event.get("event") == "payment.captured":
        entity = event["payload"]["payment"]["entity"]
        notes = entity.get("notes", {})
        course_id = int(notes.get("course_id", 0))
        clerk_id = notes.get("clerk_id", "")
        razorpay_order_id = entity.get("order_id")

        if not course_id or not clerk_id:
            return {"status": "ignored", "reason": "missing notes"}

        # ── STEP 3: Idempotency guard — prevent duplicate enrollment ─────────
        existing = db.query(Enrollment).filter(
            Enrollment.razorpay_order_id == razorpay_order_id
        ).first()
        if existing:
            return {"status": "already_processed"}

        # ── STEP 4: Create enrollment ────────────────────────────────────────
        # Also look up the batch linked to this course
        course = db.query(Course).filter(Course.id == course_id).first()
        batch_id = None
        if course and course.batches:
            batch_id = course.batches[0].batch_id   # First batch linked to course

        enrollment = Enrollment(
            student_clerk_id=clerk_id,
            course_id=course_id,
            batch_id=batch_id,
            razorpay_order_id=razorpay_order_id,
        )
        db.add(enrollment)
        db.commit()

        # ── STEP 5: Send confirmation email (non-blocking background task) ───
        background_tasks.add_task(_send_purchase_email, clerk_id, course_id)

    return {"status": "ok"}

# ── Background Email ──────────────────────────────────────────────────────────

def _send_purchase_email(clerk_id: str, course_id: int):
    """Sends a purchase confirmation email via Resend API."""
    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "EdTech Platform <noreply@yourdomain.com>",
            "to": [f"{clerk_id}@placeholder.com"],  # Replace with real user email from Clerk API
            "subject": "Course Purchase Confirmed!",
            "html": f"<p>You are now enrolled in course #{course_id}. Start learning!</p>",
        })
    except Exception as e:
        print(f"Email failed for {clerk_id}: {e}")   # Log but don't crash the webhook

# ── Manual Enrollment (Admin) ─────────────────────────────────────────────────

class ManualEnrollRequest(BaseModel):
    student_clerk_id: str
    course_id: int
    batch_id: int | None = None

@router.post("/manual-enroll")
def manual_enroll(
    payload: ManualEnrollRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Admin-only: manually enrol a student (scholarships, support cases)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403)

    existing = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == payload.student_clerk_id,
        Enrollment.course_id == payload.course_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = Enrollment(
        student_clerk_id=payload.student_clerk_id,
        course_id=payload.course_id,
        batch_id=payload.batch_id,
        is_manual=True,
    )
    db.add(enrollment)
    db.commit()
    return {"status": "enrolled"}
```

---

## 4. Frontend — Checkout Flow

### 4.1 `frontend/src/components/BuyButton.jsx`

```jsx
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL;

export function BuyButton({ courseId, courseName, price }) {
  const { getToken } = useAuth();

  const handleBuy = async () => {
    const token = await getToken();

    // Step 1: Create Razorpay order via FastAPI
    const res = await fetch(`${API_URL}/payments/create-order`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ course_id: courseId }),
    });

    if (res.status === 409) {
      alert("You're already enrolled in this course!");
      return;
    }
    if (!res.ok) {
      alert("Failed to initiate payment. Please try again.");
      return;
    }

    const { order_id, amount } = await res.json();

    // Step 2: Open Razorpay Checkout modal
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount,                           // In paise
      currency: "INR",
      name: "EdTech Platform",
      description: courseName,
      order_id,
      handler: () => {
        // Payment success — Razorpay will fire the webhook to FastAPI automatically
        // Redirect to My Courses after a brief delay
        setTimeout(() => { window.location.href = "/my-courses"; }, 1500);
      },
      modal: {
        ondismiss: () => console.log("Checkout closed"),
      },
      theme: { color: "#6366f1" },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response) => {
      console.error("Payment failed:", response.error);
      alert(`Payment failed: ${response.error.description}`);
    });
    rzp.open();
  };

  return (
    <button
      onClick={handleBuy}
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
    >
      Enrol Now — ₹{price}
    </button>
  );
}
```

### 4.2 Add Razorpay Script — `frontend/index.html`

```html
<head>
  <!-- ... other tags ... -->
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
```

---

## 5. Razorpay Dashboard Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys** → generate test key pair
3. Go to **Settings → Webhooks** → Add webhook URL: `https://your-api.onrender.com/payments/webhook`
4. Subscribe to event: `payment.captured`
5. Copy the webhook secret to `RAZORPAY_KEY_SECRET` (same as API secret)

---

## 6. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/create-order` | JWT | Creates Razorpay order, returns order_id |
| `POST` | `/payments/webhook` | None (HMAC sig) | Handles payment.captured event |
| `POST` | `/payments/manual-enroll` | Admin only | Grants access without payment |

---

## 7. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 | Create Razorpay test account. Set API keys in env. Write `create_order` endpoint. |
| Day 2 | Test `create_order` in Swagger UI. Verify `order_id` returned correctly. |
| Day 3 | Add Razorpay checkout JS to `index.html`. Build `BuyButton` component. |
| Day 4 | Test payment flow end-to-end using Razorpay test card `4111 1111 1111 1111`. |
| Day 5 | Write webhook handler with HMAC verification + idempotency guard. |
| Day 6 | Test webhook using Razorpay test webhooks dashboard. Verify enrollment created. |

---

## 8. Acceptance Criteria

- [ ] `POST /payments/create-order` returns a valid `order_id` from Razorpay
- [ ] Razorpay checkout modal opens when "Enrol Now" is clicked
- [ ] Test payment succeeds with Razorpay test card
- [ ] Webhook creates enrollment row in Supabase on `payment.captured`
- [ ] Duplicate webhook events do NOT create duplicate enrollment (idempotency)
- [ ] Tampered webhook (wrong signature) returns `400`
- [ ] Admin can manually enrol a student via `POST /payments/manual-enroll`
- [ ] Purchase confirmation email is sent (check Resend dashboard or logs)

---

## 9. Environment Variables Introduced

```env
# Frontend .env.local
VITE_RAZORPAY_KEY_ID=rzp_test_...

# Backend .env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RESEND_API_KEY=re_...
```
