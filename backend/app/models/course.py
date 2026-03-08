from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    subject = Column(String(100))  # e.g. 'Physics', 'Chemistry'
    target_exam = Column(String(50))  # e.g. 'JEE', 'NEET'
    teacher_clerk_id = Column(String(100), nullable=False, index=True)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    thumbnail_path = Column(String)  # ImageKit path
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lessons = relationship("Lesson", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course")
    batches = relationship("BatchCourseLink", back_populates="course")
