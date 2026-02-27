# SPEC-12 — Admin Panel

| Field | Value |
|-------|-------|
| **Module** | Admin Dashboard, User Management, Payment Logs, Report Export |
| **Phase** | Phase 2–3 |
| **Week** | Weeks 6–7 |
| **PRD Refs** | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06 |
| **Depends On** | SPEC-07 (Payments), SPEC-09 (Batches), SPEC-08 (Enrollments) |

---

## 1. Overview

The admin panel gives platform operators a visual interface to monitor the platform's health, manage users and enrollments, review payment logs, and export data — without database access. All admin endpoints are gated by `require_admin` (Clerk role = `admin`).

---

## 2. Backend — `backend/app/routers/admin.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional
import csv, io
from app.database import get_db
from app.dependencies.auth import require_admin
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.batch import Batch
from app.models.test import TestAttempt

router = APIRouter(prefix="/admin", tags=["admin"])

# ── Overview Dashboard ────────────────────────────────────────────────────────

@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    today = datetime.utcnow().date()
    month_start = today.replace(day=1)

    total_enrollments = db.query(Enrollment).count()
    today_enrollments = db.query(Enrollment).filter(
        func.date(Enrollment.enrolled_at) == today
    ).count()
    active_batches = db.query(Batch).count()
    total_courses = db.query(Course).count()

    return {
        "total_enrollments": total_enrollments,
        "today_enrollments": today_enrollments,
        "active_batches": active_batches,
        "total_courses": total_courses,
        # Revenue can be calculated if you store payment amount in enrollments
    }

# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users")
def list_all_enrollments(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Returns all enrollments with student info, optionally filtered by batch."""
    q = db.query(Enrollment)
    if batch_id:
        q = q.filter(Enrollment.batch_id == batch_id)
    enrollments = q.order_by(Enrollment.enrolled_at.desc()).all()

    return [
        {
            "student_clerk_id": e.student_clerk_id,
            "course_id": e.course_id,
            "course_title": e.course.title if e.course else None,
            "batch_id": e.batch_id,
            "batch_name": e.batch.name if e.batch else None,
            "enrolled_at": e.enrolled_at,
            "razorpay_order_id": e.razorpay_order_id,
            "is_manual": e.is_manual,
        }
        for e in enrollments
    ]

@router.delete("/users/{student_clerk_id}/enrollment/{course_id}", status_code=204)
def remove_enrollment(
    student_clerk_id: str,
    course_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin removes a student's enrollment from a course."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == student_clerk_id,
        Enrollment.course_id == course_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404)
    db.delete(enrollment)
    db.commit()

# ── Content Calendar ──────────────────────────────────────────────────────────

@router.get("/content-calendar")
def get_content_calendar(
    batch_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Returns all lessons for a batch, flagging teachers who haven't uploaded in 14 days."""
    from app.models.lesson import Lesson
    from app.models.batch import BatchCourseLink

    links = db.query(BatchCourseLink).filter(BatchCourseLink.batch_id == batch_id).all()
    course_ids = [l.course_id for l in links]
    lessons = db.query(Lesson).filter(Lesson.course_id.in_(course_ids)).all()

    threshold = datetime.utcnow() - timedelta(days=14)
    result = []
    for lesson in lessons:
        result.append({
            "id": lesson.id,
            "title": lesson.title,
            "course_id": lesson.course_id,
            "has_media": lesson.imagekit_path is not None,
            "created_at": lesson.created_at,
            "overdue": lesson.imagekit_path is None and lesson.created_at < threshold,
        })
    return result

# ── Payment Logs ──────────────────────────────────────────────────────────────

@router.get("/payment-logs")
def get_payment_logs(
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    q = db.query(Enrollment).filter(Enrollment.razorpay_order_id.isnot(None))
    if from_date:
        q = q.filter(Enrollment.enrolled_at >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(Enrollment.enrolled_at <= datetime.fromisoformat(to_date))
    return q.order_by(Enrollment.enrolled_at.desc()).all()

# ── CSV Export ────────────────────────────────────────────────────────────────

@router.get("/export/enrollments")
def export_enrollments_csv(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Exports enrollment data as a downloadable CSV file."""
    q = db.query(Enrollment)
    if batch_id:
        q = q.filter(Enrollment.batch_id == batch_id)
    enrollments = q.all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["student_clerk_id", "course_title", "batch_name", "enrolled_at", "is_manual", "razorpay_order_id"])
    for e in enrollments:
        writer.writerow([
            e.student_clerk_id,
            e.course.title if e.course else "",
            e.batch.name if e.batch else "",
            e.enrolled_at.isoformat() if e.enrolled_at else "",
            e.is_manual,
            e.razorpay_order_id or "",
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=enrollments.csv"},
    )
```

---

## 3. Frontend — Admin Dashboard

### `frontend/src/pages/AdminDashboard.jsx`

```jsx
import { useEffect, useState } from "react";
import { useFetch } from "../hooks/useFetch";

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch("/admin/overview").then(setOverview);
    authFetch("/admin/users").then(setUsers);
  }, []);

  const handleExport = async () => {
    const token = await getToken();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/export/enrollments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "enrollments.csv"; a.click();
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stat cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Enrollments", value: overview.total_enrollments },
            { label: "Today's Enrollments", value: overview.today_enrollments },
            { label: "Active Batches", value: overview.active_batches },
            { label: "Total Courses", value: overview.total_courses },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <p className="text-3xl font-bold text-indigo-600 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* User Table */}
      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="font-semibold">Recent Enrollments</h2>
          <button onClick={handleExport} className="text-sm text-indigo-600 underline">
            Export CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{["Student ID", "Course", "Batch", "Enrolled At", "Manual"].map(h =>
              <th key={h} className="text-left px-6 py-3 text-gray-500 font-medium">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {users.slice(0, 20).map((u, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-6 py-3 font-mono text-xs">{u.student_clerk_id.slice(0, 12)}...</td>
                <td className="px-6 py-3">{u.course_title}</td>
                <td className="px-6 py-3">{u.batch_name}</td>
                <td className="px-6 py-3">{new Date(u.enrolled_at).toLocaleDateString("en-IN")}</td>
                <td className="px-6 py-3">{u.is_manual ? "✅" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 4. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/overview` | Admin | Platform health stats |
| `GET` | `/admin/users` | Admin | All enrollments with user info |
| `DELETE` | `/admin/users/{id}/enrollment/{cid}` | Admin | Remove enrollment |
| `GET` | `/admin/content-calendar` | Admin | Lesson schedule with overdue flags |
| `GET` | `/admin/payment-logs` | Admin | Filtered payment/enrollment log |
| `GET` | `/admin/export/enrollments` | Admin | Downloads CSV export |

---

## 5. Implementation Steps

| Day | Task |
|-----|------|
| Day 1–2 | Write all admin API endpoints. Test in Swagger. |
| Day 3–4 | Build Admin Dashboard frontend with stat cards and enrollment table. |
| Day 5 | Add CSV export button and file download logic. |
| Day 6 | Add content calendar view with overdue teacher flagging. |

---

## 6. Acceptance Criteria

- [ ] Non-admin users receive `403` on all `/admin/*` endpoints
- [ ] Overview stats are accurate (tested by creating enrollments and checking counts)
- [ ] Admin can remove an enrollment and the student loses access
- [ ] CSV export downloads a valid `.csv` file that opens in Excel/Google Sheets
- [ ] Content calendar shows lessons and flags entries with no media for >14 days

---

## 7. Environment Variables Introduced

No new variables.
