from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.engine import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")
    password_changed_at = Column(DateTime)
    api_key = Column(String, unique=True, nullable=True)
    api_key_hash = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
