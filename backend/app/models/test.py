from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    subject = Column(String(100))
    chapter = Column(String(200))
    question_text = Column(Text, nullable=False)  # Supports LaTeX syntax
    options = Column(JSONB)  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_option = Column(String(1))  # 'A' | 'B' | 'C' | 'D'
    explanation = Column(Text)
    positive_marks = Column(Numeric(4, 1), default=4)
    negative_marks = Column(Numeric(4, 1), default=1)


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(Integer, primary_key=True)
    student_clerk_id = Column(String(100), nullable=False, index=True)
    test_id = Column(Integer, nullable=False)
    answers = Column(JSONB)  # {"q_id": "A", ...}
    score = Column(Numeric(6, 1))
    accuracy_percent = Column(Numeric(5, 2))
    time_taken_sec = Column(Integer)
    submitted_at = Column(DateTime, default=datetime.utcnow)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True)
    student_clerk_id = Column(String(100), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    timestamp_seconds = Column(Integer, nullable=False)
    label = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="bookmarks")
