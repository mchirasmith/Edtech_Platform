from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # e.g. 'JEE 2026 — Class 12'
    target_exam = Column(String(50))
    year = Column(Integer)
    start_date = Column(DateTime)
    created_by = Column(String(100))  # admin clerk_id

    enrollments = relationship("Enrollment", back_populates="batch")
    courses = relationship("BatchCourseLink", back_populates="batch")


class BatchCourseLink(Base):
    __tablename__ = "batch_course_links"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    batch = relationship("Batch", back_populates="courses")
    course = relationship("Course", back_populates="batches")
