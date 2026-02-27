# Agent Context — SPEC-04: Course & Content Management

## Your Task
Build the full CRUD API for courses and lessons in FastAPI, enforce teacher/admin access control, create the Teacher Dashboard UI (course list + create form + lesson manager), and build the Student Catalog page.

## Pre-Conditions
- SPEC-02 done: `get_current_user`, `require_teacher`, `require_admin` dependencies exist in `app/dependencies/auth.py`
- SPEC-03 done: `Course`, `Lesson`, `Enrollment` SQLAlchemy models exist
- `get_db` dependency exists in `app/database.py`

## Files to Create

### `backend/app/schemas/course.py`
```python
# Pydantic models — use model_dump(exclude_unset=True) for patches
class CourseCreate(BaseModel): title, description, subject, target_exam, price
class CourseUpdate(BaseModel): title?, description?, price?      # all Optional
class CourseOut(BaseModel): id, title, description, subject, target_exam, price, thumbnail_path, teacher_clerk_id, created_at  # Config from_attributes=True
class LessonCreate(BaseModel): title, description?, order_index, media_type
class LessonOut(BaseModel): id, course_id, title, order_index, media_type?, imagekit_path?, dpp_pdf_path?
```

### `backend/app/routers/courses.py`
Endpoints:
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/courses/catalog` | None (public) | All courses for browse page |
| GET | `/courses/` | JWT | Students: only enrolled. Teacher/Admin: all |
| GET | `/courses/{id}` | JWT | |
| POST | `/courses/` | require_teacher | Create; set `teacher_clerk_id = current_user["clerk_id"]` |
| PUT | `/courses/{id}` | require_teacher | Check ownership: `course.teacher_clerk_id == clerk_id OR role=="admin"` else 403 |
| DELETE | `/courses/{id}` | require_teacher | |
| GET | `/courses/{id}/lessons` | JWT | Order by `order_index` |
| POST | `/courses/{id}/lessons` | require_teacher | |
| POST | `/courses/{id}/lessons/{lid}/dpp` | require_teacher | UploadFile, call `storage.upload_pdf()`, save path |

**Student filtering logic for `GET /courses/`:**
```python
enrollments = db.query(Enrollment).filter(Enrollment.student_clerk_id == clerk_id).all()
course_ids = [e.course_id for e in enrollments]
return db.query(Course).filter(Course.id.in_(course_ids)).all()
```

Register router in `main.py`: `app.include_router(courses.router)`

### `frontend/src/pages/TeacherDashboard.jsx`
- List teacher's courses via `GET /courses/`
- Create form: title, subject, target_exam, price → `POST /courses/`
- Each course row has a "Manage →" link to `/teacher/courses/{id}`

### `frontend/src/pages/Catalog.jsx`
- Fetch `GET /courses/catalog` (no auth)
- Render `<CourseCard>` grid

### `frontend/src/components/CourseCard.jsx`
- Show thumbnail (ImageKit URL with `?tr=w-400,h-225`)
- Show title, subject, target_exam, price
- "Enrol Now" button → leads to payment (SPEC-07)

### `frontend/src/pages/TeacherCourseManager.jsx`
- Shows lessons list for a course
- Form to add lesson (title, order_index, media_type)
- DPP PDF upload via `<input type="file">` → `POST /courses/{id}/lessons/{lid}/dpp`
- Media upload widget will come from SPEC-05

## Access Control Rules
- `POST /courses/` — teacher or admin only (403 for students)
- `PUT /courses/{id}` — must own the course OR be admin (403 otherwise)
- `GET /courses/catalog` — publicly accessible (no JWT required)
- DPP paths stored in DB; signed URLs generated at access time (SPEC-08)

## Done When
- [ ] Teacher can create, edit, delete a course
- [ ] Student calling `POST /courses/` gets `403`
- [ ] `GET /courses/catalog` works without a JWT
- [ ] Student's `GET /courses/` returns only their enrolled courses
- [ ] Lessons are returned sorted by `order_index`
- [ ] DPP PDF uploads to Supabase Storage and saves path to `lesson.dpp_pdf_path`

## Read Next
Full code: `docs/specs/SPEC-04-COURSE-MANAGEMENT.md`
