"""用户已查看频道视频追踪模型"""
from sqlalchemy import Column, Integer, DateTime, UniqueConstraint, func
from app.db.engine import Base


class ChannelVideoSeen(Base):
    """用户已查看频道视频记录表 - 用于持久化追踪用户是否已与视频交互"""
    __tablename__ = "channel_video_seen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    channel_video_id = Column(Integer, nullable=False)
    seen_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'channel_video_id', name='uq_user_channel_video_seen'),
    )