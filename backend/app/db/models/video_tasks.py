from sqlalchemy import Column, Integer, String, DateTime, Float, Text, func, UniqueConstraint
from sqlalchemy.orm import declarative_base

from app.db.engine import Base


class VideoTask(Base):
    __tablename__ = "video_tasks"
    __table_args__ = (
        UniqueConstraint('task_id', 'user_id', name='uq_task_user'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String, nullable=True)  # 允许 URL 解析失败时为空
    platform = Column(String, nullable=False)
    task_id = Column(String, nullable=False)  # 移除 unique=True，改为复合唯一
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
    tags = Column(Text, nullable=True)              # JSON: {"platform_tags": [], "ai_tags": []}
    # 多用户复用相关字段
    deleted_at = Column(DateTime, nullable=True)    # 软删除时间戳
    source_task_id = Column(String, nullable=True)  # 指向原始任务的 task_id（复用追踪）
    note_style = Column(String, nullable=True)      # 用户选择的笔记风格（minimal/academic等）