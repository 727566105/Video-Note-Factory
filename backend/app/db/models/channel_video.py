"""频道视频共享缓存 + 分批获取状态模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, UniqueConstraint, func
from app.db.engine import Base


class ChannelVideo(Base):
    """频道视频共享缓存表 - 跨用户共享同一博主的视频数据"""
    __tablename__ = "channel_videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)          # bilibili/youtube/douyin
    platform_id = Column(String, nullable=False)       # 博主唯一标识（mid/channelId/uid）
    content_id = Column(String, nullable=False)        # 视频唯一标识（bvid/videoId）
    content_url = Column(String)                       # 视频链接
    title = Column(String)
    cover_url = Column(String)
    duration = Column(Float)
    author = Column(String)
    published_at = Column(DateTime)
    raw_info = Column(Text)                            # 原始 API 数据（JSON）
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('platform', 'platform_id', 'content_id', name='uq_channel_video'),
    )


class ChannelFetchStatus(Base):
    """频道分批获取状态表 - 记录每个博主的分批获取进度"""
    __tablename__ = "channel_fetch_status"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)
    platform_id = Column(String, nullable=False)
    total_videos = Column(Integer, default=0)          # 博主总视频数
    fetched_count = Column(Integer, default=0)         # 已获取数量
    next_page = Column(Integer, default=1)             # B站用（页码）
    next_cursor = Column(String, default="0")          # 抖音用（游标）
    fetch_status = Column(String, default="initial")   # initial/partial/complete/error
    last_fetch_at = Column(DateTime)
    error_message = Column(Text)

    __table_args__ = (
        UniqueConstraint('platform', 'platform_id', name='uq_channel_fetch'),
    )
