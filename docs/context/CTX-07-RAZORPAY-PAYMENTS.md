# Agent Context — SPEC-07: Razorpay Payment Gateway

## Your Task
Implement the complete Razorpay payment flow: server-side order creation in FastAPI, React checkout modal, a HMAC-SHA256 verified webhook handler that creates the enrollment on `payment.captured`, idempotency guard to prevent duplicate enrollments, and a background email on purchase.

## Pre-Conditions
- SPEC-02 done: `get_current_user` auth dependency
- SPEC-03 done: `Enrollment`, `Course`, `Batch`, `BatchCourseLink` models
- Razorpay account created at [razorpay.com](https://razorpay.com)
- Resend account created at [resend.com](https://resend.com)

## Critical Security Rules
1. **NEVER** verify payment on the frontend — the webhook is the only source of truth
2. **ALWAYS** verify HMAC-SHA256 signature before any DB write in webhook
3. **ALWAYS** check for existing enrollment with `razorpay_order_id` (idempotency) before creating new one
4. The webhook endpoint has **NO Clerk JWT auth** — it's called by Razorpay directly

## Files to Create

### `backend/app/routers/payments.py`
```python
import hmac, hashlib, razorpay

rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

# POST /payments/create-order  (get_current_user)
# 1. Get course → 404 if not found
# 2. Check existing enrollment → 409 if already enrolled
# 3. rzp_client.order.create({"amount": int(price*100), "currency":"INR", "notes": {course_id, clerk_id}})
# 4. Return: {order_id, amount, currency, course_title}

# POST /payments/webhook  (NO AUTH — HMAC verified)
# 1. raw_body = await request.body()
# 2. expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
# 3. if not hmac.compare_digest(received, expected): raise 400
# 4. Parse event → only process "payment.captured"
# 5. Idempotency: check Enrollment.razorpay_order_id == order_id → return "already_processed" if exists
# 6. Create Enrollment with batch_id from course's first linked batch
# 7. background_tasks.add_task(_send_purchase_email, clerk_id, course_id)
# 8. Return {status: "ok"}

# POST /payments/manual-enroll  (require_admin)
# Creates enrollment with is_manual=True, no razorpay_order_id
```

### `frontend/src/components/BuyButton.jsx`
```jsx
// 1. POST /payments/create-order with {course_id}
// 2. Handle 409 → alert "Already enrolled"
// 3. Open Razorpay modal:
//    new window.Razorpay({key, amount, currency, name, order_id, handler: () => setTimeout → /my-courses})
//    rzp.on("payment.failed", ...)
//    rzp.open()
```

### `frontend/index.html`
Add before `</head>`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### `backend/app/services/email.py` (minimal)
```python
def _send_purchase_email(clerk_id: str, course_id: int):
    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({...})
    except Exception as e:
        print(f"Email error: {e}")  # Non-fatal — never crash the webhook
```

## Razorpay Dashboard Actions
1. Settings → Webhooks → Add Endpoint: `https://your-api.onrender.com/payments/webhook`
2. Subscribe to: `payment.captured`
3. Copy webhook secret (same as `RAZORPAY_KEY_SECRET`)

## Amount Units
Razorpay uses **paise** (not rupees). Multiply price by 100:
```python
"amount": int(course.price * 100)
```

## Environment Variables
```env
# frontend/.env.local
VITE_RAZORPAY_KEY_ID=rzp_test_...

# backend/.env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RESEND_API_KEY=re_...
```

## Done When
- [ ] `POST /payments/create-order` returns a valid Razorpay `order_id`
- [ ] Razorpay test card `4111 1111 1111 1111` completes payment
- [ ] Webhook creates an `Enrollment` row on `payment.captured`
- [ ] Second webhook with same `razorpay_order_id` does NOT create duplicate row
- [ ] Modified/tampered webhook signature returns `400`
- [ ] Admin can manually enroll a student without payment

## Read Next
Full code: `docs/specs/SPEC-07-RAZORPAY-PAYMENTS.md`
