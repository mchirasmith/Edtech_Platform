from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class DoubtMessage(Base):
    __tablename__ = "doubt_messages"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    sender_clerk_id = Column(String(100), nullable=False)
    content = Column(Text)
    image_path = Column(String)  # Supabase Storage path for image doubts
    audio_imagekit_path = Column(String)  # ImageKit path for voice notes
    is_resolved = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
