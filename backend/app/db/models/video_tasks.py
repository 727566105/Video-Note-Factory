from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base

from app.db.engine import Base


class VideoTask(Base):
    __tablename__ = "video_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    task_id = Column(String, unique=True, nullable=False)
    video_url = Column(String, nullable=True)  # 新增字段，nullable=True 兼容旧数据
    created_at = Column(DateTime, server_default=func.now())