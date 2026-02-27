# Agent Context — SPEC-03: Database Schema & Migrations

## Your Task
Define every SQLAlchemy ORM model for the platform. Configure Alembic migrations against Supabase PostgreSQL. Create the Supabase Storage bucket for DPP PDFs and write the `upload_pdf` service function.

## Pre-Conditions
- SPEC-01 complete: `database.py` and `Base` exist
- Supabase project created. `DATABASE_URL` and `SUPABASE_*` keys in `.env`

## Critical Design Rule
**No `users` table.** Clerk user IDs (e.g. `user_2abc123`) are stored directly as `String` columns across all tables. No passwords, no sessions in your DB.

## Models to Create (one file each under `backend/app/models/`)

### `models/course.py` — `Course`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | |
| `title` | String(255) NOT NULL | |
| `description` | Text | |
| `subject` | String(100) | e.g. 'Physics' |
| `target_exam` | String(50) | 'JEE' or 'NEET' |
| `teacher_clerk_id` | String(100) NOT NULL, indexed | |
| `price` | Numeric(10,2) | |
| `thumbnail_path` | String | ImageKit path |
| `created_at` / `updated_at` | DateTime | |

Relationships: `lessons`, `enrollments`, `batches` (via `BatchCourseLink`)

### `models/lesson.py` — `Lesson`
| Column | Type | Notes |
|--------|------|-------|
| `course_id` | FK → courses, CASCADE | |
| `order_index` | Integer | For sorting |
| `media_type` | String(20) | `'video'` \| `'audio'` \| `'pdf'` \| `'text'` |
| `imagekit_file_id` | String | Set after upload |
| `imagekit_path` | String | e.g. `/edtech/courses/1/lessons/2/video.mp4` |
| `dpp_pdf_path` | String | Supabase Storage path |
| `unlock_after_id` | FK → lessons (nullable) | Content unlock gate |

### `models/batch.py` — `Batch` + `BatchCourseLink`
`Batch`: `name`, `target_exam`, `year`, `start_date`, `created_by` (clerk_id)
`BatchCourseLink`: `batch_id` FK, `course_id` FK (join table, many-to-many)

### `models/enrollment.py` — `Enrollment`
Unique constraint: `(student_clerk_id, course_id)`
Columns: `student_clerk_id`, `course_id` FK, `batch_id` FK (nullable), `razorpay_order_id` (unique), `enrolled_at`, `is_manual` Boolean.

### `models/progress.py` — `LessonProgress`
Unique constraint: `(student_clerk_id, lesson_id)`
Columns: `watch_percent` (0–100), `completed` Boolean (True when ≥ 90%), `last_position_sec` (for resume).

### `models/doubt.py` — `DoubtMessage`
Columns: `batch_id` FK indexed, `sender_clerk_id`, `content`, `image_path`, `audio_imagekit_path`, `is_resolved`, `is_pinned`, `sent_at`.

### `models/test.py` — `TestQuestion` + `TestAttempt` + `Bookmark`
`TestQuestion`: `question_text`, `options` (JSONB `{"A":..., "B":..., "C":..., "D":...}`), `correct_option` String(1), `explanation`, `positive_marks` Numeric(4,1), `negative_marks` Numeric(4,1).
`TestAttempt`: `answers` JSONB `{"q_id": "A"}`, `score`, `accuracy_percent`, `time_taken_sec`.
`Bookmark`: `student_clerk_id`, `lesson_id` FK, `timestamp_seconds`, `label`.

## `__init__.py` Import Pattern
Create `backend/app/models/__init__.py` that imports ALL models so Alembic can discover them:
```python
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.batch import Batch, BatchCourseLink
from app.models.enrollment import Enrollment
from app.models.progress import LessonProgress
from app.models.doubt import DoubtMessage
from app.models.test import TestQuestion, TestAttempt, Bookmark
```

## Alembic Setup
```bash
alembic init alembic
# In alembic/env.py:
# from app.database import Base
# from app import models
# target_metadata = Base.metadata
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

## Supabase Storage — `backend/app/services/storage.py`
```python
from supabase import create_client
_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def upload_pdf(file_bytes: bytes, destination_path: str) -> str:
    _client.storage.from_("dpp-files").upload(path=destination_path, file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"})
    return _client.storage.from_("dpp-files").create_signed_url(destination_path, 3600)["signedURL"]
```
Create the `dpp-files` Storage bucket in Supabase Dashboard (set to **private/non-public**).
Also create `doubt-images` bucket (public OK for chat images).

## Environment Variables
```env
DATABASE_URL=postgres://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Done When
- [ ] `alembic upgrade head` runs without errors
- [ ] All 8 tables appear in Supabase → Table Editor
- [ ] `UniqueConstraint` on enrollments prevents duplicate (student, course) rows
- [ ] `dpp-files` and `doubt-images` Storage buckets exist in Supabase

## Read Next
Full schema details: `docs/specs/SPEC-03-DATABASE-SCHEMA.md`
