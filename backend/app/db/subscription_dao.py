"""订阅和动态数据访问层"""
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.db.models.subscriptions import Subscription, FeedItem
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ── Subscription CRUD ──

def add_subscription(user_id: int, channel_url: str, platform: str,
                     channel_name: str = None, platform_id: str = None,
                     avatar_url: str = None) -> Subscription:
    db = next(get_db())
    try:
        existing = db.query(Subscription).filter_by(
            user_id=user_id, channel_url=channel_url
        ).first()
        if existing:
            return existing
        sub = Subscription(
            user_id=user_id,
            channel_url=channel_url,
            platform=platform,
            channel_name=channel_name,
            platform_id=platform_id,
            avatar_url=avatar_url,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub
    except Exception as e:
        db.rollback()
        logger.error(f"添加订阅失败: {e}")
        raise
    finally:
        db.close()


def remove_subscription(sub_id: int, user_id: int):
    db = next(get_db())
    try:
        sub = db.query(Subscription).filter_by(id=sub_id, user_id=user_id).first()
        if sub:
            db.delete(sub)
            db.commit()
            logger.info(f"订阅已删除: id={sub_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"删除订阅失败: {e}")
        raise
    finally:
        db.close()


def toggle_subscription(sub_id: int, user_id: int) -> Optional[Subscription]:
    db = next(get_db())
    try:
        sub = db.query(Subscription).filter_by(id=sub_id, user_id=user_id).first()
        if sub:
            sub.enabled = 0 if sub.enabled == 1 else 1
            db.commit()
            db.refresh(sub)
            return sub
    except Exception as e:
        db.rollback()
        logger.error(f"切换订阅状态失败: {e}")
    finally:
        db.close()


def get_user_subscriptions(user_id: int) -> list[Subscription]:
    db = next(get_db())
    try:
        return db.query(Subscription).filter_by(user_id=user_id).order_by(
            Subscription.created_at.desc()
        ).all()
    finally:
        db.close()


def get_subscription_by_url(user_id: int, channel_url: str) -> Optional[Subscription]:
    db = next(get_db())
    try:
        return db.query(Subscription).filter_by(
            user_id=user_id, channel_url=channel_url
        ).first()
    finally:
        db.close()


def get_all_enabled_subscriptions() -> list[Subscription]:
    db = next(get_db())
    try:
        return db.query(Subscription).filter_by(enabled=1).all()
    finally:
        db.close()


def update_subscription_check(sub_id: int):
    db = next(get_db())
    try:
        sub = db.query(Subscription).filter_by(id=sub_id).first()
        if sub:
            from datetime import datetime
            sub.last_checked_at = datetime.now()
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"更新订阅检查时间失败: {e}")
    finally:
        db.close()


# ── FeedItem CRUD ──

def upsert_feed_items(items: list[dict]) -> int:
    """批量插入动态，按 content_id+platform 去重，返回新增数量"""
    db = next(get_db())
    added = 0
    try:
        for item in items:
            content_id = item.get("content_id")
            platform = item.get("platform")
            if not content_id or not platform:
                continue
            existing = db.query(FeedItem).filter_by(
                content_id=content_id, platform=platform
            ).first()
            if existing:
                continue
            feed = FeedItem(**item)
            db.add(feed)
            added += 1
        db.commit()
        return added
    except Exception as e:
        db.rollback()
        logger.error(f"批量插入动态失败: {e}")
        return 0
    finally:
        db.close()


def get_feed_items(user_id: int, limit: int = 20, offset: int = 0,
                   content_type: str = None) -> list[FeedItem]:
    db = next(get_db())
    try:
        query = db.query(FeedItem).filter_by(user_id=user_id)
        if content_type:
            query = query.filter_by(content_type=content_type)
        return query.order_by(FeedItem.published_at.desc()).offset(offset).limit(limit).all()
    finally:
        db.close()


def get_feed_item_by_id(item_id: int, user_id: int) -> Optional[FeedItem]:
    db = next(get_db())
    try:
        return db.query(FeedItem).filter_by(id=item_id, user_id=user_id).first()
    finally:
        db.close()


def mark_read(user_id: int, item_id: int):
    db = next(get_db())
    try:
        item = db.query(FeedItem).filter_by(id=item_id, user_id=user_id).first()
        if item:
            item.is_read = 1
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"标记已读失败: {e}")
    finally:
        db.close()


def mark_all_read(user_id: int):
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(user_id=user_id, is_read=0).update({"is_read": 1})
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"全部标为已读失败: {e}")
    finally:
        db.close()


def get_unread_count(user_id: int) -> int:
    db = next(get_db())
    try:
        return db.query(FeedItem).filter_by(user_id=user_id, is_read=0).count()
    finally:
        db.close()


def get_feed_items_by_subscription(sub_id: int, limit: int = 20) -> list[FeedItem]:
    db = next(get_db())
    try:
        return db.query(FeedItem).filter_by(subscription_id=sub_id).order_by(
            FeedItem.published_at.desc()
        ).limit(limit).all()
    finally:
        db.close()


def get_summarized_channels(user_id: int) -> list[dict]:
    """从 video_tasks 聚合已总结过的频道"""
    db = next(get_db())
    try:
        from app.db.models.video_tasks import VideoTask
        from sqlalchemy import func as sa_func
        results = db.query(
            VideoTask.platform,
            VideoTask.author,
            VideoTask.video_url,
            sa_func.count(VideoTask.id).label("count"),
            sa_func.max(VideoTask.created_at).label("last_summarized"),
        ).filter_by(user_id=user_id).group_by(
            VideoTask.platform, VideoTask.author, VideoTask.video_url
        ).all()
        channels = []
        for r in results:
            if not r.author:
                continue
            channels.append({
                "platform": r.platform,
                "author": r.author,
                "video_url": r.video_url,
                "count": r.count,
                "last_summarized": r.last_summarized.isoformat() if r.last_summarized else None,
            })
        return channels
    finally:
        db.close()


def update_feed_item_task(item_id: int, task_id: str):
    db = next(get_db())
    try:
        item = db.query(FeedItem).filter_by(id=item_id).first()
        if item:
            item.task_id = task_id
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"更新动态任务ID失败: {e}")
    finally:
        db.close()