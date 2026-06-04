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
    model_name = Column(String, nullable=True)
    provider_id = Column(String, nullable=True)
    extras = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
