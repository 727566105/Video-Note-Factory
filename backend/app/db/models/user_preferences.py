from sqlalchemy import Column, Integer, ForeignKey, DateTime, func
from sqlalchemy.types import JSON
from app.db.engine import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    preferences = Column(JSON, default={})
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
