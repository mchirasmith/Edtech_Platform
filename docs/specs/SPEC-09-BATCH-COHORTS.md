# SPEC-09 — Batch Cohort System

| Field | Value |
|-------|-------|
| **Module** | Batch Isolation, Cohort Dashboard, Content Calendar, Admin Reassignment |
| **Phase** | Phase 2 |
| **Week** | Week 5 (Days 1–3) |
| **PRD Refs** | BATCH-01, BATCH-02, BATCH-03, BATCH-04, BATCH-05 |
| **Depends On** | SPEC-03 (DB Schema), SPEC-07 (Payments — batch assigned at enrollment) |

---

## 1. Overview

Batches are the core isolation unit of the platform. A "Batch" groups students by target exam and year (e.g., "JEE 2026 — Class 12"). Every content endpoint — lessons, doubts, tests — is filtered by `batch_id`. A student from Batch A cannot access any content, chat, or test results from Batch B. Admins create batches and can reassign students between batches.

---

## 2. Backend — `backend/app/routers/batches.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.batch import Batch, BatchCourseLink
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/batches", tags=["batches"])

class BatchCreate(BaseModel):
    name: str
    target_exam: str
    year: int
    start_date: Optional[datetime] = None

class BatchOut(BaseModel):
    id: int
    name: str
    target_exam: str
    year: int
    start_date: Optional[datetime]
    class Config:
        from_attributes = True

# ── Batch CRUD (Admin only) ───────────────────────────────────────────────────

@router.post("/", response_model=BatchOut, status_code=201)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    batch = Batch(**payload.model_dump(), created_by=current_user["clerk_id"])
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

@router.get("/", response_model=list[BatchOut])
def list_batches(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return db.query(Batch).all()

@router.get("/my-batch")
def get_my_batch(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns the batch the current student is enrolled in."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.batch_id.isnot(None),
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in any batch")
    return enrollment.batch

# ── Link Course to Batch ──────────────────────────────────────────────────────

@router.post("/{batch_id}/courses/{course_id}", status_code=201)
def link_course_to_batch(
    batch_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    link = BatchCourseLink(batch_id=batch_id, course_id=course_id)
    db.add(link)
    db.commit()
    return {"status": "linked"}

# ── Batch Isolation Dependency ────────────────────────────────────────────────

def get_student_batch_id(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> int:
    """
    Reusable dependency: returns the student's batch_id.
    Used by lessons, doubts, and test routers to filter content.
    """
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.batch_id.isnot(None),
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not assigned to a batch")
    return enrollment.batch_id

# ── Admin: Reassign Student to Different Batch ────────────────────────────────

class ReassignRequest(BaseModel):
    student_clerk_id: str
    new_batch_id: int

@router.post("/reassign")
def reassign_student(
    payload: ReassignRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin moves a student from one batch to another (e.g., Class 12 → Dropper)."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == payload.student_clerk_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Verify new batch exists
    new_batch = db.query(Batch).filter(Batch.id == payload.new_batch_id).first()
    if not new_batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    enrollment.batch_id = payload.new_batch_id
    db.commit()
    return {"status": "reassigned", "new_batch": new_batch.name}
```

---

## 3. Frontend — Batch Dashboard

### `frontend/src/pages/BatchDashboard.jsx`

```jsx
import { useEffect, useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

export default function BatchDashboard() {
  const [batch, setBatch] = useState(null);
  const [courses, setCourses] = useState([]);
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch("/batches/my-batch").then(setBatch);
    authFetch("/courses/").then(setCourses);
  }, []);

  if (!batch) return <div className="p-8 text-center">Loading your batch...</div>;

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Batch Header */}
      <div className="bg-indigo-600 text-white rounded-2xl p-6 mb-8">
        <h1 className="text-2xl font-bold">{batch.name}</h1>
        <p className="text-indigo-200 mt-1">{batch.target_exam} · {batch.year}</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "My Courses", path: "/my-courses", icon: "📚" },
          { label: "Doubt Chat", path: "/doubt-chat", icon: "💬" },
          { label: "Mock Tests", path: "/tests", icon: "📝" },
          { label: "Leaderboard", path: "/leaderboard", icon: "🏆" },
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <span className="text-3xl mb-2">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Course List for this Batch */}
      <h2 className="text-xl font-semibold mb-4">Batch Courses</h2>
      <div className="space-y-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{course.title}</p>
              <p className="text-sm text-gray-500">{course.subject}</p>
            </div>
            <span className="text-indigo-500">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

## 4. Batch Isolation — How It Works

Every content endpoint that needs batch isolation uses the `get_student_batch_id` dependency:

```python
# Example: lessons endpoint filtered to student's batch
@router.get("/batches/{batch_id}/lessons")
def get_batch_lessons(
    batch_id: int,
    db: Session = Depends(get_db),
    student_batch_id: int = Depends(get_student_batch_id),  # from batches.py
):
    if batch_id != student_batch_id:
        raise HTTPException(status_code=403, detail="Access denied to this batch")
    # ... return lessons for this batch
```

---

## 5. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/batches/` | Admin | Create a new batch |
| `GET` | `/batches/` | JWT | List all batches |
| `GET` | `/batches/my-batch` | JWT | Current student's batch |
| `POST` | `/batches/{id}/courses/{cid}` | Admin | Link a course to a batch |
| `POST` | `/batches/reassign` | Admin | Move student to different batch |

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 | Write `batches.py` router. Create `get_student_batch_id` dependency. |
| Day 2 | Build Batch Dashboard frontend page. Connect to API. |
| Day 3 | Add batch isolation enforcement to existing lesson and content endpoints. Verify students cannot cross-access batch content. |

---

## 7. Acceptance Criteria

- [ ] Admin can create a batch and link courses to it
- [ ] After purchase, student's enrollment has `batch_id` set correctly
- [ ] `GET /batches/my-batch` returns the correct batch for an enrolled student
- [ ] Student in Batch A cannot access content endpoints for Batch B (returns `403`)
- [ ] Admin can reassign a student to a new batch without affecting their enrollment
- [ ] Batch Dashboard renders correct batch name and linked courses

---

## 8. Environment Variables Introduced

No new variables.
