# SPEC-08 — Enrollment & Content Access Gates

| Field | Value |
|-------|-------|
| **Module** | Enrollment System, My Courses Page, Access Control |
| **Phase** | Phase 1 |
| **Week** | Week 4 (Day 7) |
| **PRD Refs** | PAY-04, PAY-05, COURSE-05, BATCH-03 |
| **Depends On** | SPEC-07 (Razorpay Payments), SPEC-04 (Course Management) |

---

## 1. Overview

This spec covers the post-payment experience: the "My Courses" page, enrollment verification on all content access endpoints, the DPP unlock gate (PDF available only after lesson completion), and the batch assignment flow after enrollment.

---

## 2. Backend — Enrollment Queries

### `backend/app/routers/enrollments.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.progress import LessonProgress

router = APIRouter(prefix="/enrollments", tags=["enrollments"])

@router.get("/my-courses")
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns all courses the authenticated student is enrolled in."""
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"]
    ).all()

    result = []
    for enrollment in enrollments:
        course = enrollment.course
        # Calculate overall completion percentage
        lessons = db.query(Lesson).filter(Lesson.course_id == course.id).all()
        if lessons:
            completed = db.query(LessonProgress).filter(
                LessonProgress.student_clerk_id == current_user["clerk_id"],
                LessonProgress.lesson_id.in_([l.id for l in lessons]),
                LessonProgress.completed == True,
            ).count()
            completion_pct = round((completed / len(lessons)) * 100)
        else:
            completion_pct = 0

        result.append({
            "course": {
                "id": course.id,
                "title": course.title,
                "subject": course.subject,
                "thumbnail_path": course.thumbnail_path,
            },
            "batch_id": enrollment.batch_id,
            "enrolled_at": enrollment.enrolled_at,
            "completion_percent": completion_pct,
        })

    return result

@router.get("/check/{course_id}")
def check_enrollment(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Quick check: is the current user enrolled in a course?"""
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.course_id == course_id,
    ).first()
    return {"enrolled": enrollment is not None}

@router.get("/lessons/{lesson_id}/dpp-url")
def get_dpp_url(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a signed DPP PDF download URL.
    Gated: lesson must be marked completed (watch_percent >= 90).
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404)

    if not lesson.dpp_pdf_path:
        raise HTTPException(status_code=404, detail="No DPP attached to this lesson")

    # Enrollment check
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_clerk_id == current_user["clerk_id"],
        Enrollment.course_id == lesson.course_id,
    ).first()
    if not enrollment and current_user["role"] == "student":
        raise HTTPException(status_code=403, detail="Not enrolled")

    # Completion gate — DPP unlocks only after lesson is completed
    progress = db.query(LessonProgress).filter(
        LessonProgress.student_clerk_id == current_user["clerk_id"],
        LessonProgress.lesson_id == lesson_id,
    ).first()

    if current_user["role"] == "student" and (not progress or not progress.completed):
        raise HTTPException(
            status_code=403,
            detail="Complete the video lesson to unlock the DPP",
        )

    # Generate a signed 1-hour download URL from Supabase Storage
    from supabase import create_client
    from app.config import settings
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    result = supabase.storage.from_("dpp-files").create_signed_url(lesson.dpp_pdf_path, 3600)
    return {"pdf_url": result["signedURL"], "expires_in": 3600}
```

---

## 3. Frontend — My Courses Page

### `frontend/src/pages/MyCourses.jsx`

```jsx
import { useEffect, useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

const IK_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;

export default function MyCourses() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { authFetch } = useFetch();

  useEffect(() => {
    authFetch("/enrollments/my-courses")
      .then(setEnrollments)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading your courses...</div>;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">My Courses</h1>

      {enrollments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">You haven't enrolled in any courses yet.</p>
          <Link to="/catalog" className="text-indigo-600 underline">Browse courses</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrollments.map(({ course, completion_percent, enrolled_at }) => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="block border rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              {course.thumbnail_path && (
                <img
                  src={`${IK_ENDPOINT}${course.thumbnail_path}?tr=w-600,h-337`}
                  alt={course.title}
                  className="w-full object-cover h-40"
                />
              )}
              <div className="p-4">
                <h3 className="font-semibold text-lg">{course.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{course.subject}</p>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${completion_percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{completion_percent}%</span>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  Enrolled {new Date(enrolled_at).toLocaleDateString("en-IN")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 4. DPP Unlock UI — `frontend/src/components/DPPButton.jsx`

```jsx
import { useEffect, useState } from "react";
import { useFetch } from "../hooks/useFetch";

export function DPPButton({ lessonId, isCompleted }) {
  const { authFetch } = useFetch();

  const handleDownload = async () => {
    if (!isCompleted) return;
    const { pdf_url } = await authFetch(`/enrollments/lessons/${lessonId}/dpp-url`);
    window.open(pdf_url, "_blank");
  };

  return (
    <button
      onClick={handleDownload}
      disabled={!isCompleted}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        isCompleted
          ? "bg-green-500 text-white hover:bg-green-600"
          : "bg-gray-200 text-gray-400 cursor-not-allowed"
      }`}
    >
      📄 {isCompleted ? "Download DPP" : "Complete lesson to unlock DPP"}
    </button>
  );
}
```

---

## 5. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/enrollments/my-courses` | JWT | All enrolled courses with completion % |
| `GET` | `/enrollments/check/{course_id}` | JWT | Enrollment status for a course |
| `GET` | `/enrollments/lessons/{id}/dpp-url` | JWT + Enrolled + Completed | Signed DPP PDF URL |

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Day 7 AM | Write `enrollments.py` router with all three endpoints. |
| Day 7 PM | Build `MyCourses` page with progress bars. Build `DPPButton` component. |
| Day 7 EOD | End-to-end test: pay → enrollment created → My Courses shows the course → watch 90% → DPP unlocks. |

---

## 7. Acceptance Criteria

- [ ] `GET /enrollments/my-courses` returns only the authenticated student's enrolled courses
- [ ] Completion percentage is calculated correctly based on `lesson_progress` records
- [ ] `GET /enrollments/lessons/{id}/dpp-url` returns `403` if lesson not completed
- [ ] DPP URL is a signed Supabase Storage URL (not a permanent public link)
- [ ] My Courses page shows progress bar per course
- [ ] Unenrolled students cannot access any lesson stream URLs

---

## 8. Environment Variables Introduced

No new variables. Uses SPEC-03 Supabase (for Storage signed URLs) and SPEC-02 JWT auth.
