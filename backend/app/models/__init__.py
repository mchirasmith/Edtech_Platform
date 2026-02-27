"""
Models package — SQLAlchemy ORM models.

All models import Base from app.database and are auto-discovered by Alembic.
Models to build (per SPEC-03 Database Schema):
  - course.py           Course, Lesson
  - user.py             (Clerk-managed; use clerk_id string here)
  - enrollment.py       Enrollment
  - batch.py            Batch
  - test.py             Test, Question, TestAttempt
  - doubt.py            DoubtMessage
  - bookmark.py         Bookmark
  - notification.py     Notification
"""
