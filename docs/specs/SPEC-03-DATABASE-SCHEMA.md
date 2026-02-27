# SPEC-03 — Database Schema & Migrations

| Field | Value |
|-------|-------|
| **Module** | Supabase PostgreSQL + SQLAlchemy Models + Alembic |
| **Phase** | Phase 1 |
| **Week** | Week 2 (Days 1–2) |
| **PRD Refs** | Section 6.2 Database Schema |
| **Depends On** | SPEC-01 (Project Setup), SPEC-02 (Clerk Auth) |

---

## 1. Overview

This spec defines all SQLAlchemy ORM models, the full PostgreSQL schema, relationships between tables, and the Alembic migration setup. Supabase is used purely as a managed PostgreSQL host — no RLS, no Edge Functions, no Supabase Realtime. All business logic lives in FastAPI.

**Key design decision**: The Clerk user ID (e.g. `user_2abc123`) is used as the user identifier across all tables. No separate `users` table with passwords or sessions is needed.

---

## 2. Database Engine — `backend/app/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,      # Automatically reconnects on stale connections
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 3. SQLAlchemy Models — `backend/app/models/`

Split into separate files per domain.

### 3.1 `models/course.py`

```python
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Course(Base):
    __tablename__ = "courses"

    id                = Column(Integer, primary_key=True, index=True)
    title             = Column(String(255), nullable=False)
    description       = Column(Text)
    subject           = Column(String(100))           # e.g. 'Physics', 'Chemistry'
    target_exam       = Column(String(50))            # e.g. 'JEE', 'NEET'
    teacher_clerk_id  = Column(String(100), nullable=False, index=True)
    price             = Column(Numeric(10, 2), nullable=False, default=0)
    thumbnail_path    = Column(String)                # Supabase Storage path
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lessons     = relationship("Lesson", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course")
    batches     = relationship("BatchCourseLink", back_populates="course")
```

### 3.2 `models/lesson.py`

```python
class Lesson(Base):
    __tablename__ = "lessons"

    id                = Column(Integer, primary_key=True, index=True)
    course_id         = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title             = Column(String(255), nullable=False)
    description       = Column(Text)
    order_index       = Column(Integer, nullable=False, default=0)
    media_type        = Column(String(20))             # 'video' | 'audio' | 'pdf' | 'text'
    imagekit_file_id  = Column(String)                 # ImageKit file ID (for video/audio)
    imagekit_path     = Column(String)                 # e.g. /edtech/courses/1/lessons/2/video.mp4
    dpp_pdf_path      = Column(String)                 # Supabase Storage path for DPP PDF
    unlock_after_id   = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

    course    = relationship("Course", back_populates="lessons")
    progress  = relationship("LessonProgress", back_populates="lesson")
    bookmarks = relationship("Bookmark", back_populates="lesson")
```

### 3.3 `models/batch.py`

```python
class Batch(Base):
    __tablename__ = "batches"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(255), nullable=False)    # e.g. 'JEE 2026 — Class 12'
    target_exam  = Column(String(50))
    year         = Column(Integer)
    start_date   = Column(DateTime)
    created_by   = Column(String(100))                   # admin clerk_id

    enrollments  = relationship("Enrollment", back_populates="batch")
    courses      = relationship("BatchCourseLink", back_populates="batch")

class BatchCourseLink(Base):
    __tablename__ = "batch_course_links"

    id        = Column(Integer, primary_key=True)
    batch_id  = Column(Integer, ForeignKey("batches.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    batch  = relationship("Batch", back_populates="courses")
    course = relationship("Course", back_populates="batches")
```

### 3.4 `models/enrollment.py`

```python
from sqlalchemy import UniqueConstraint

class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_clerk_id", "course_id", name="uq_enrollment"),
    )

    id                 = Column(Integer, primary_key=True, index=True)
    student_clerk_id   = Column(String(100), nullable=False, index=True)
    course_id          = Column(Integer, ForeignKey("courses.id"), nullable=False)
    batch_id           = Column(Integer, ForeignKey("batches.id"), nullable=True)
    razorpay_order_id  = Column(String(100), unique=True)
    enrolled_at        = Column(DateTime, default=datetime.utcnow)
    is_manual          = Column(Boolean, default=False)    # True for admin-granted access

    course = relationship("Course", back_populates="enrollments")
    batch  = relationship("Batch", back_populates="enrollments")
```

### 3.5 `models/progress.py`

```python
class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("student_clerk_id", "lesson_id", name="uq_progress"),
    )

    id                = Column(Integer, primary_key=True)
    student_clerk_id  = Column(String(100), nullable=False, index=True)
    lesson_id         = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    watch_percent     = Column(Integer, default=0)     # 0–100
    completed         = Column(Boolean, default=False)  # True when watch_percent >= 90
    last_position_sec = Column(Integer, default=0)     # Resume playback from here
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="progress")
```

### 3.6 `models/doubt.py`

```python
class DoubtMessage(Base):
    __tablename__ = "doubt_messages"

    id                  = Column(Integer, primary_key=True)
    batch_id            = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    sender_clerk_id     = Column(String(100), nullable=False)
    content             = Column(Text)
    image_path          = Column(String)                  # Supabase Storage path for image doubts
    audio_imagekit_path = Column(String)                  # ImageKit path for voice notes
    is_resolved         = Column(Boolean, default=False)
    is_pinned           = Column(Boolean, default=False)
    sent_at             = Column(DateTime, default=datetime.utcnow)
```

### 3.7 `models/test.py`

```python
from sqlalchemy.dialects.postgresql import JSONB

class TestQuestion(Base):
    __tablename__ = "test_questions"

    id              = Column(Integer, primary_key=True)
    course_id       = Column(Integer, ForeignKey("courses.id"))
    subject         = Column(String(100))
    chapter         = Column(String(200))
    question_text   = Column(Text, nullable=False)   # Supports LaTeX syntax
    options         = Column(JSONB)                  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_option  = Column(String(1))              # 'A' | 'B' | 'C' | 'D'
    explanation     = Column(Text)
    positive_marks  = Column(Numeric(4,1), default=4)
    negative_marks  = Column(Numeric(4,1), default=1)

class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id                = Column(Integer, primary_key=True)
    student_clerk_id  = Column(String(100), nullable=False, index=True)
    test_id           = Column(Integer, nullable=False)
    answers           = Column(JSONB)                # {"q_id": "A", ...}
    score             = Column(Numeric(6,1))
    accuracy_percent  = Column(Numeric(5,2))
    time_taken_sec    = Column(Integer)
    submitted_at      = Column(DateTime, default=datetime.utcnow)

class Bookmark(Base):
    __tablename__ = "bookmarks"

    id                = Column(Integer, primary_key=True)
    student_clerk_id  = Column(String(100), nullable=False)
    lesson_id         = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    timestamp_seconds = Column(Integer, nullable=False)
    label             = Column(String(500))
    created_at        = Column(DateTime, default=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="bookmarks")
```

---

## 4. Alembic Setup

```bash
cd backend
alembic init alembic

# Edit alembic/env.py — point to your models and DATABASE_URL:
# from app.database import Base
# from app import models   # import all models so Alembic discovers them
# target_metadata = Base.metadata

alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

---

## 5. Supabase Storage — PDF Uploads

```python
# backend/app/services/storage.py
from supabase import create_client
from app.config import settings

_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def upload_pdf(file_bytes: bytes, destination_path: str) -> str:
    """Uploads a PDF file to Supabase Storage 'dpp-files' bucket. Returns signed URL."""
    _client.storage.from_("dpp-files").upload(
        path=destination_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    # Generate a signed URL (valid 1 hour) for secure download
    result = _client.storage.from_("dpp-files").create_signed_url(destination_path, 3600)
    return result["signedURL"]
```

---

## 6. Implementation Steps

| Day | Task |
|-----|------|
| Day 1 AM | Create Supabase project. Copy connection string to `DATABASE_URL`. |
| Day 1 PM | Write all SQLAlchemy models. Verify imports and relationships. |
| Day 2 AM | Initialize Alembic. Configure `env.py`. Generate initial migration. |
| Day 2 PM | Run `alembic upgrade head` against Supabase. Verify tables in Supabase Dashboard. Create `dpp-files` Storage bucket. |

---

## 7. Acceptance Criteria

- [ ] `alembic upgrade head` runs without errors against Supabase
- [ ] All tables appear in Supabase Dashboard → Table Editor
- [ ] `UniqueConstraint` on enrollments prevents duplicate enrollment for same (student, course)
- [ ] `get_db` dependency yields and closes sessions correctly (verify with pytest)
- [ ] Supabase Storage `dpp-files` bucket exists and is non-public

---

## 8. Environment Variables Introduced

```env
# Backend .env
DATABASE_URL=postgres://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
