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


def find_subscription_by_platform_id(platform: str, platform_id: str) -> Optional[Subscription]:
    """跨用户查找已有订阅（用于复用）"""
    db = next(get_db())
    try:
        return db.query(Subscription).filter_by(
            platform=platform, platform_id=platform_id
        ).first()
    finally:
        db.close()


def copy_feed_items_to_user(source_sub_id: int, target_user_id: int, target_sub_id: int) -> int:
    """将已有 FeedItem 复制到新用户的订阅（用于复用）"""
    db = next(get_db())
    copied = 0
    try:
        source_items = db.query(FeedItem).filter_by(subscription_id=source_sub_id).all()
        for item in source_items:
            # 按 content_id + platform 去重，避免重复复制
            existing = db.query(FeedItem).filter_by(
                user_id=target_user_id,
                content_id=item.content_id,
                platform=item.platform
            ).first()
            if existing:
                continue
            # 复制 FeedItem，关联到新用户和新订阅
            new_item = FeedItem(
                user_id=target_user_id,
                subscription_id=target_sub_id,
                platform=item.platform,
                content_type=item.content_type,
                content_id=item.content_id,
                content_url=item.content_url,
                title=item.title,
                cover_url=item.cover_url,
                images=item.images,
                duration=item.duration,
                author=item.author,
                description=item.description,
                published_at=item.published_at,
                raw_info=item.raw_info,
                task_id=item.task_id,
            )
            db.add(new_item)
            copied += 1
        db.commit()
        return copied
    except Exception as e:
        db.rollback()
        logger.error(f"复制 FeedItem 失败: {e}")
        return 0
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
    """批量插入动态，按 user_id+content_id+platform 去重，已存在则更新关联，返回新增数量"""
    db = next(get_db())
    added = 0
    try:
        for item in items:
            content_id = item.get("content_id")
            platform = item.get("platform")
            user_id = item.get("user_id")
            if not content_id or not platform or not user_id:
                continue
            existing = db.query(FeedItem).filter_by(
                user_id=user_id,
                content_id=content_id,
                platform=platform
            ).first()
            if existing:
                if item.get("subscription_id") and existing.subscription_id != item["subscription_id"]:
                    existing.subscription_id = item["subscription_id"]
                if item.get("task_id") and not existing.task_id:
                    existing.task_id = item["task_id"]
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


def get_feed_items_by_subscription(sub_id: int, limit: int = 20, offset: int = 0) -> list[FeedItem]:
    db = next(get_db())
    try:
        # 先按 subscription_id 查询
        items = db.query(FeedItem).filter_by(subscription_id=sub_id).order_by(
            FeedItem.published_at.desc()
        ).offset(offset).limit(limit).all()
        if items:
            return items
        # 复用场景：FeedItem 可能关联到其他（甚至已删除的）订阅
        # 按 platform + author 查询同一频道的内容
        sub = db.query(Subscription).filter_by(id=sub_id).first()
        if sub and sub.channel_name:
            return db.query(FeedItem).filter_by(
                platform=sub.platform, author=sub.channel_name
            ).order_by(
                FeedItem.published_at.desc()
            ).limit(limit).all()
        return []
    finally:
        db.close()


def count_feed_items_by_subscription(sub_id: int) -> int:
    db = next(get_db())
    try:
        # 先按 subscription_id 计数
        count = db.query(FeedItem).filter_by(subscription_id=sub_id).count()
        if count > 0:
            return count
        # 复用场景：按 platform + author 查询
        sub = db.query(Subscription).filter_by(id=sub_id).first()
        if sub and sub.channel_name:
            return db.query(FeedItem).filter_by(
                platform=sub.platform, author=sub.channel_name
            ).count()
        return 0
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