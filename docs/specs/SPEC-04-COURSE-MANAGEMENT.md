# SPEC-04 — Course & Content Management

| Field | Value |
|-------|-------|
| **Module** | Courses, Lessons, Teacher Dashboard, Student Catalog |
| **Phase** | Phase 1 |
| **Week** | Week 2 (Days 3–7) |
| **PRD Refs** | COURSE-01 through COURSE-07 |
| **Depends On** | SPEC-02 (Clerk Auth), SPEC-03 (Database Schema) |

---

## 1. Overview

This spec covers the full CRUD API for courses and lessons in FastAPI, access control (teachers/admins write, students read), the Teacher Dashboard UI for content management, and the Student Catalog page showing batch-filtered courses with enrollment status.

---

## 2. Pydantic Schemas — `backend/app/schemas/course.py`

```python
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional, List

class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: str
    target_exam: str
    price: Decimal

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None

class CourseOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    subject: str
    target_exam: str
    price: Decimal
    thumbnail_path: Optional[str]
    teacher_clerk_id: str
    created_at: datetime
    class Config:
        from_attributes = True

class LessonCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int
    media_type: str          # 'video' | 'audio' | 'pdf' | 'text'

class LessonOut(BaseModel):
    id: int
    course_id: int
    title: str
    order_index: int
    media_type: Optional[str]
    imagekit_path: Optional[str]
    dpp_pdf_path: Optional[str]
    class Config:
        from_attributes = True
```

---

## 3. API Endpoints — `backend/app/routers/courses.py`

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies.auth import get_current_user, require_teacher
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.schemas.course import CourseCreate, CourseUpdate, CourseOut, LessonCreate, LessonOut
from app.services.storage import upload_pdf

router = APIRouter(prefix="/courses", tags=["courses"])

# ── Course CRUD ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """All users: returns courses filtered by the student's batch enrollments."""
    if current_user["role"] in ["teacher", "admin"]:
        return db.query(Course).all()
    # Students: only courses they're enrolled in
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"]
    ).all()
    course_ids = [e.course_id for e in enrollments]
    return db.query(Course).filter(Course.id.in_(course_ids)).all()

@router.get("/catalog", response_model=list[CourseOut])
def get_catalog(db: Session = Depends(get_db)):
    """Public: returns all available courses for the purchase/browse page."""
    return db.query(Course).all()

@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.post("/", response_model=CourseOut, status_code=201)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    course = Course(**payload.model_dump(), teacher_clerk_id=current_user["clerk_id"])
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404)
    if course.teacher_clerk_id != current_user["clerk_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not your course")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    db.refresh(course)
    return course

@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404)
    db.delete(course)
    db.commit()

# ── Lesson CRUD ──────────────────────────────────────────────────────────────

@router.get("/{course_id}/lessons", response_model=list[LessonOut])
def list_lessons(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return db.query(Lesson).filter(Lesson.course_id == course_id).order_by(Lesson.order_index).all()

@router.post("/{course_id}/lessons", response_model=LessonOut, status_code=201)
def create_lesson(
    course_id: int,
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    lesson = Lesson(**payload.model_dump(), course_id=course_id)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson

@router.post("/{course_id}/lessons/{lesson_id}/dpp")
async def upload_lesson_dpp(
    course_id: int,
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_teacher),
):
    """Upload a DPP PDF to Supabase Storage and update lesson record."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.course_id == course_id).first()
    if not lesson:
        raise HTTPException(status_code=404)
    content = await file.read()
    path = f"dpp/{course_id}/{lesson_id}/{file.filename}"
    signed_url = upload_pdf(content, path)
    lesson.dpp_pdf_path = path
    db.commit()
    return {"pdf_url": signed_url}
```

---

## 4. Frontend Components

### 4.1 Student Catalog — `frontend/src/pages/Catalog.jsx`

```jsx
import { useState, useEffect } from "react";
import { useFetch } from "../hooks/useFetch";
import { CourseCard } from "../components/CourseCard";

export default function Catalog() {
  const [courses, setCourses] = useState([]);
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch("/courses/catalog").then(setCourses);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

### 4.2 Course Card — `frontend/src/components/CourseCard.jsx`

```jsx
export function CourseCard({ course }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow p-4">
      {course.thumbnail_path && (
        <img
          src={`${import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT}${course.thumbnail_path}?tr=w-400,h-225`}
          alt={course.title}
          className="rounded-lg w-full object-cover mb-3"
        />
      )}
      <h3 className="font-semibold text-lg">{course.title}</h3>
      <p className="text-sm text-gray-500">{course.subject} · {course.target_exam}</p>
      <p className="mt-2 font-bold text-indigo-600">₹{course.price}</p>
    </div>
  );
}
```

### 4.3 Teacher Dashboard — `frontend/src/pages/TeacherDashboard.jsx`

```jsx
import { useState, useEffect } from "react";
import { useFetch } from "../hooks/useFetch";

export default function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: "", subject: "", target_exam: "", price: "" });
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch("/courses/").then(setCourses);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const created = await authFetch("/courses/", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setCourses((prev) => [...prev, created]);
    setForm({ title: "", subject: "", target_exam: "", price: "" });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>

      <form onSubmit={handleCreate} className="mb-8 space-y-3 bg-gray-50 p-4 rounded-lg">
        <input placeholder="Course Title" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border rounded px-3 py-2" required />
        <input placeholder="Subject (e.g. Physics)" value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="w-full border rounded px-3 py-2" required />
        <input placeholder="Target Exam (JEE/NEET)" value={form.target_exam}
          onChange={(e) => setForm({ ...form, target_exam: e.target.value })}
          className="w-full border rounded px-3 py-2" />
        <input type="number" placeholder="Price (₹)" value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-full border rounded px-3 py-2" required />
        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded">
          Create Course
        </button>
      </form>

      <div className="space-y-4">
        {courses.map((c) => (
          <div key={c.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-gray-500">{c.subject} · ₹{c.price}</p>
            </div>
            <a href={`/teacher/courses/${c.id}`} className="text-indigo-600 text-sm">
              Manage →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/courses/catalog` | None | Public course listing |
| `GET` | `/courses/` | JWT | My courses (students) or all (teacher/admin) |
| `GET` | `/courses/{id}` | JWT | Single course details |
| `POST` | `/courses/` | Teacher/Admin | Create course |
| `PUT` | `/courses/{id}` | Teacher/Admin | Update course metadata |
| `DELETE` | `/courses/{id}` | Teacher/Admin | Delete course |
| `GET` | `/courses/{id}/lessons` | JWT | List lessons in order |
| `POST` | `/courses/{id}/lessons` | Teacher/Admin | Create lesson |
| `POST` | `/courses/{id}/lessons/{lid}/dpp` | Teacher/Admin | Upload DPP PDF |

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Day 3 | Write Pydantic schemas. Write FastAPI course CRUD router. Register router in `main.py`. |
| Day 4 | Write lesson CRUD endpoints including DPP upload. Test all endpoints with FastAPI Swagger UI. |
| Day 5 | Build Teacher Dashboard UI — course list + create form. Wire to FastAPI. |
| Day 6 | Build Student Catalog page with `CourseCard` components. |
| Day 7 | Write pytest fixtures and tests for all course/lesson endpoints. |

---

## 7. Acceptance Criteria

- [ ] Teacher can create, update, and delete a course via the dashboard
- [ ] Student cannot call `POST /courses/` (returns 403)
- [ ] `GET /courses/catalog` returns courses without authentication
- [ ] `GET /courses/` for a student returns only their enrolled courses
- [ ] Lesson order is respected (`order_index`)
- [ ] DPP PDF uploads successfully to Supabase Storage and path is saved on the lesson

---

## 8. Environment Variables Introduced

No new variables. Uses `DATABASE_URL` (Spec 03) and Clerk JWT (Spec 02).
