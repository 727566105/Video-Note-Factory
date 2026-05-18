"""订阅和动态相关的数据库模型"""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, func
from app.db.engine import Base


class Subscription(Base):
    """用户订阅关系"""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    channel_url = Column(String, nullable=False)
    channel_name = Column(String, nullable=True)
    platform = Column(String, nullable=False)
    platform_id = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    enabled = Column(Integer, default=1)
    fetch_interval = Column(Integer, default=60)
    last_checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class FeedItem(Base):
    """动态内容（缓存的视频/图文信息）"""
    __tablename__ = "feed_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    subscription_id = Column(Integer, nullable=True)
    platform = Column(String, nullable=False)
    content_type = Column(String, default="video")
    content_id = Column(String, nullable=True)
    content_url = Column(String, nullable=True)
    title = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)
    images = Column(Text, nullable=True)
    duration = Column(Float, nullable=True)
    author = Column(String, nullable=True)
    description = Column(String, nullable=True)
    published_at = Column(DateTime, nullable=True)
    raw_info = Column(Text, nullable=True)
    is_read = Column(Integer, default=0)
    task_id = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())