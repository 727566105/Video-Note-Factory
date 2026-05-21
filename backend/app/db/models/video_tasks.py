from sqlalchemy import Column, Integer, String, DateTime, Float, func
from sqlalchemy.orm import declarative_base

from app.db.engine import Base


class VideoTask(Base):
    __tablename__ = "video_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    task_id = Column(String, unique=True, nullable=False)
    video_url = Column(String, nullable=True)  # 新增字段，nullable=True 兼容旧数据
    user_id = Column(Integer, nullable=True, default=1)  # 关联用户，默认 admin
    created_at = Column(DateTime, server_default=func.now())
    # 视频元数据（从下载结果中提取并持久化）
    title = Column(String, nullable=True)       # 视频标题
    cover_url = Column(String, nullable=True)   # 封面图 URL
    duration = Column(Float, nullable=True)     # 视频时长（秒）
    author = Column(String, nullable=True)      # 作者名
    description = Column(String, nullable=True)  # 视频描述
    author_id = Column(String, nullable=True)       # 博主唯一ID（B站 mid、抖音 uid、YouTube channel_id）
    author_name = Column(String, nullable=True)     # 博主名称（冗余存储）