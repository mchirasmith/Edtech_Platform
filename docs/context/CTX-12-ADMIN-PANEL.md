# Agent Context — SPEC-12: Admin Panel

## Your Task
Build the admin API endpoints and React Admin Dashboard: platform health overview stats, enrollment management table with CSV export, content calendar showing lesson upload status, payment logs with date filtering, and admin-initiated batch reassignment.

## Pre-Conditions
- SPEC-02 done: `require_admin` dependency exists
- SPEC-09 done: `Batch`, `BatchCourseLink` models; batch reassignment endpoint (call from here or reuse)
- SPEC-07 done: `Enrollment` rows with `razorpay_order_id`, `is_manual` fields

## Files to Create

### `backend/app/routers/admin.py`
```
All endpoints use: current_user: dict = Depends(require_admin)

GET /admin/overview
  Return: {total_enrollments, today_enrollments, active_batches, total_courses}
  Use sqlalchemy func.date(Enrollment.enrolled_at) == today for "today" count

GET /admin/users?batch_id=
  Return list of all enrollments with:
    student_clerk_id, course_title, batch_name, enrolled_at, is_manual, razorpay_order_id
  Optional filter by batch_id

DELETE /admin/users/{student_clerk_id}/enrollment/{course_id}
  → Delete the enrollment → student loses access immediately

GET /admin/content-calendar?batch_id=
  Logic:
    1. Get all BatchCourseLinks for batch_id → course_ids
    2. Get all Lessons for those courses
    3. Mark lesson as "overdue" if imagekit_path IS NULL AND created_at < 14 days ago
  Return: [{id, title, course_id, has_media, created_at, overdue}]

GET /admin/payment-logs?from_date=&to_date=
  → Enrollments where razorpay_order_id IS NOT NULL, filtered by date range

GET /admin/export/enrollments?batch_id=
  → Return Response(content=csv_string, media_type="text/csv")
  → Headers: Content-Disposition: attachment; filename=enrollments.csv
  → CSV columns: student_clerk_id, course_title, batch_name, enrolled_at, is_manual, razorpay_order_id
  Use Python's csv.writer and io.StringIO
```
Register in `main.py`.

### `frontend/src/pages/AdminDashboard.jsx`
Layout — three sections:

**1. Stat Cards Row**
Fetch `GET /admin/overview` → 4 cards: Total Enrollments, Today's Enrollments, Active Batches, Total Courses

**2. Enrollment Table**
Fetch `GET /admin/users` → show table with columns: Student ID, Course, Batch, Enrolled At, Manual?
- "Export CSV" button → `GET /admin/export/enrollments` → trigger file download via `URL.createObjectURL(blob)`
- "Remove" button per row → `DELETE /admin/users/{id}/enrollment/{cid}` → refresh list

**3. Content Calendar Tab**
Batch selector → fetch `GET /admin/content-calendar?batch_id=X`
Show lesson rows with red ⚠️ badge if `overdue: true`

## CSV Download Pattern (Frontend)
```js
const res = await fetch(`${API_URL}/admin/export/enrollments`, {headers: {Authorization: `Bearer ${token}`}});
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a"); a.href=url; a.download="enrollments.csv"; a.click();
URL.revokeObjectURL(url);
```

## Role Protection
Every admin page must be wrapped in `<ProtectedRoute requiredRole="admin">`.
Every admin API endpoint uses `Depends(require_admin)` — returns 403 for non-admins.

## Done When
- [ ] Overview stats are accurate (verify by creating enrollments and checking count)
- [ ] Enrollment table shows all enrollments with correct course and batch names
- [ ] CSV export downloads a valid file that opens in spreadsheet apps
- [ ] Removing an enrollment prevents student from accessing that course
- [ ] Content calendar flags lessons created >14 days ago with no media upload
- [ ] Non-admin user gets `403` on all `/admin/*` endpoints

## Read Next
Full code: `docs/specs/SPEC-12-ADMIN-PANEL.md`
