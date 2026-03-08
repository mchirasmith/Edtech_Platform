from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_clerk_id", "course_id", name="uq_enrollment"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_clerk_id = Column(String(100), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    razorpay_order_id = Column(String(100), unique=True)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    is_manual = Column(Boolean, default=False)  # True = admin-granted access

    course = relationship("Course", back_populates="enrollments")
    batch = relationship("Batch", back_populates="enrollments")
