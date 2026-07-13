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
                     avatar_url: str = None, unique_id: str = None) -> Subscription:
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
            unique_id=unique_id,
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


def get_subscription_by_id(sub_id: int) -> Optional[Subscription]:
    """根据订阅 ID 获取订阅信息"""
    db = next(get_db())
    try:
        return db.query(Subscription).filter_by(id=sub_id).first()
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
            # 复制 FeedItem，关联到新用户和新订阅（不复制 task_id，笔记可用性由 API 跨用户检测）
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
                channel_video_id=item.channel_video_id,
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

def upsert_feed_items(items: list[dict]) -> list[FeedItem]:
    """批量插入动态，按 user_id+content_id+platform 去重，已存在则更新关联。
    返回新增的 FeedItem 对象列表（用于自动生成笔记等后续处理）。"""
    db = next(get_db())
    new_items = []
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
            db.flush()  # 获取 id
            # 提前提取属性到 dict，防止 session 关闭后 DetachedInstanceError
            new_items.append({
                'id': feed.id,
                'content_id': feed.content_id,
                'content_url': feed.content_url,
                'task_id': feed.task_id,
                'content_type': feed.content_type,
                'title': feed.title,
            })
        db.commit()
        return new_items
    except Exception as e:
        db.rollback()
        logger.error(f"批量插入动态失败: {e}")
        return []
    finally:
        db.close()


def get_feed_items(user_id: int, limit: int = 20, offset: int = 0,
                   content_type: str = None, order: str = "desc") -> list[FeedItem]:
    db = next(get_db())
    try:
        query = db.query(FeedItem).filter_by(user_id=user_id)
        if content_type:
            query = query.filter_by(content_type=content_type)
        if order == "asc":
            query = query.order_by(FeedItem.published_at.asc())
        else:
            query = query.order_by(FeedItem.published_at.desc())
        return query.offset(offset).limit(limit).all()
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


def update_feed_item_task_by_content(content_id: str, platform: str, user_id: int, task_id: str):
    """按 content_id+platform+user_id 查找 feed_item 并回写 task_id（用于笔记生成完成后回写）"""
    db = next(get_db())
    try:
        items = db.query(FeedItem).filter_by(
            content_id=content_id, platform=platform, user_id=user_id
        ).all()
        for item in items:
            if not item.task_id:
                item.task_id = task_id
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"按内容回写 feed_item task_id 失败: {e}")
    finally:
        db.close()


# ── Channel Statistics ──

def get_channel_stats(platform: str, platform_id: str) -> dict:
    """获取频道统计信息（跨用户聚合）：订阅者数、视频数、笔记数"""
    from app.db.video_task_dao import find_completed_task_by_video

    db = next(get_db())
    try:
        # 1. 订阅者数量
        subscriber_count = db.query(Subscription).filter_by(
            platform=platform, platform_id=platform_id
        ).count()

        # 2. 获取该频道所有订阅的 ID
        subs = db.query(Subscription).filter_by(
            platform=platform, platform_id=platform_id
        ).all()
        sub_ids = [s.id for s in subs]

        # 3. 视频数量（从 feed_items 查询，去重 content_id）
        video_count = 0
        video_ids = set()
        if sub_ids:
            items = db.query(FeedItem).filter(
                FeedItem.subscription_id.in_(sub_ids),
                FeedItem.content_type == "video"
            ).all()
            for item in items:
                if item.content_id:
                    video_ids.add(item.content_id)
            video_count = len(video_ids)

        # 4. 笔记数量（检查每个视频是否有已完成的笔记文件）
        note_count = 0
        for video_id in video_ids:
            existing = find_completed_task_by_video(video_id, platform)
            if existing:
                note_count += 1

        return {
            "subscriber_count": subscriber_count,
            "video_count": video_count,
            "note_count": note_count,
        }
    finally:
        db.close()


def create_feed_items_from_channel_videos(user_id: int, subscription_id: int,
                                           channel_videos: list, platform: str):
    """从共享视频表为用户创建 feed_items（按 content_id 去重）"""
    db = next(get_db())
    try:
        # 获取该用户该平台已有的 content_id
        existing_ids = set(
            row[0] for row in db.query(FeedItem.content_id)
            .filter_by(user_id=user_id, platform=platform)
            .all()
        )

        created = 0
        for cv in channel_videos:
            if cv.content_id in existing_ids:
                continue
            item = FeedItem(
                user_id=user_id,
                subscription_id=subscription_id,
                platform=platform,
                content_type="video",
                content_id=cv.content_id,
                content_url=cv.content_url,
                title=cv.title,
                cover_url=cv.cover_url,
                duration=cv.duration,
                author=cv.author,
                published_at=cv.published_at,
                raw_info=cv.raw_info,
                channel_video_id=cv.id,
            )
            db.add(item)
            created += 1

        db.commit()
        logger.info(f"从 channel_videos 创建 feed_items: user_id={user_id}, created={created}, total={len(channel_videos)}")
        return created
    except Exception as e:
        db.rollback()
        logger.error(f"创建 feed_items 失败: {e}")
        raise
    finally:
        db.close()