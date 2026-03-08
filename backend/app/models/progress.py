from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("student_clerk_id", "lesson_id", name="uq_progress"),
    )

    id = Column(Integer, primary_key=True)
    student_clerk_id = Column(String(100), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    watch_percent = Column(Integer, default=0)  # 0–100
    completed = Column(Boolean, default=False)  # True when watch_percent >= 90
    last_position_sec = Column(Integer, default=0)  # Resume playback from here
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lesson = relationship("Lesson", back_populates="progress")
