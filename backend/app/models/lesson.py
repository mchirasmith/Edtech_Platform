from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, nullable=False, default=0)
    media_type = Column(String(20))  # 'video' | 'audio' | 'pdf' | 'text'
    imagekit_file_id = Column(String)  # ImageKit file ID (set after upload)
    imagekit_path = Column(String)  # e.g. /edtech/courses/1/lessons/2/video.mp4
    dpp_pdf_path = Column(String)  # Supabase Storage path for DPP PDF
    unlock_after_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="lessons")
    progress = relationship("LessonProgress", back_populates="lesson")
    bookmarks = relationship("Bookmark", back_populates="lesson")
