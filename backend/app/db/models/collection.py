from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, UniqueConstraint, func
from app.db.engine import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    category = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    share_token = Column(String, nullable=True)
    is_shared = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class CollectionItem(Base):
    __tablename__ = "collection_items"
    __table_args__ = (
        UniqueConstraint("collection_id", "task_id", name="uq_collection_task"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(String, ForeignKey("video_tasks.task_id"), nullable=False)
    position = Column(Integer, default=0)
    added_at = Column(DateTime, server_default=func.now())


class CollectionSummary(Base):
    __tablename__ = "collection_summaries"
    __table_args__ = (
        UniqueConstraint("collection_id", name="uq_collection_summary"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=True)
    style = Column(String, nullable=True)
    summary_mode = Column(String, default="overview")  # overview/comparison/timeline/mindmap/trajectory
    model_name = Column(String, nullable=True)
    provider_id = Column(String, nullable=True)
    extras = Column(Text, nullable=True)
    item_count_at_generation = Column(Integer, nullable=True)  # 生成总结时的条目数，用于检测 stale
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SmartCollection(Base):
    """智能合集：按规则自动归集笔记"""
    __tablename__ = "smart_collections"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    rule_type = Column(String, nullable=False)  # tag / channel / platform
    rule_value = Column(String, nullable=False)  # 标签名 / platform_id / 平台名
    target_collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=True)
    match_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class CollectionFavorite(Base):
    """合集收藏（用户收藏公开合集）"""
    __tablename__ = "collection_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "collection_id", name="uq_collection_fav"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
