"""频道视频共享缓存数据访问层"""
from typing import Optional
from datetime import datetime

from app.db.engine import get_db
from app.db.models.channel_video import ChannelVideo, ChannelFetchStatus
from app.utils.logger import get_logger

logger = get_logger(__name__)


def upsert_channel_videos(videos: list[dict], platform: str, platform_id: str) -> list[ChannelVideo]:
    """批量 upsert 视频到共享表，按 platform+platform_id+content_id 唯一约束去重，返回已持久化的列表"""
    db = next(get_db())
    result = []
    try:
        for item in videos:
            content_id = item.get("content_id")
            if not content_id:
                continue

            # 按 platform + platform_id + content_id 查询是否已存在
            existing = db.query(ChannelVideo).filter_by(
                platform=platform,
                platform_id=platform_id,
                content_id=content_id,
            ).first()

            if existing:
                # 已存在则更新可变字段
                if item.get("title") and existing.title != item["title"]:
                    existing.title = item["title"]
                if item.get("cover_url") and existing.cover_url != item["cover_url"]:
                    existing.cover_url = item["cover_url"]
                if item.get("duration") is not None:
                    existing.duration = item["duration"]
                if item.get("author") and existing.author != item["author"]:
                    existing.author = item["author"]
                if item.get("content_url") and existing.content_url != item["content_url"]:
                    existing.content_url = item["content_url"]
                if item.get("published_at") and existing.published_at != item["published_at"]:
                    existing.published_at = item["published_at"]
                if item.get("raw_info"):
                    existing.raw_info = item["raw_info"]
                result.append(existing)
            else:
                # 不存在则新建
                video = ChannelVideo(
                    platform=platform,
                    platform_id=platform_id,
                    content_id=content_id,
                    content_url=item.get("content_url"),
                    title=item.get("title"),
                    cover_url=item.get("cover_url"),
                    duration=item.get("duration"),
                    author=item.get("author"),
                    published_at=item.get("published_at"),
                    raw_info=item.get("raw_info"),
                )
                db.add(video)
                result.append(video)

        db.commit()
        # 刷新所有新插入的对象以获取自增 id
        for v in result:
            db.refresh(v)
        logger.info(f"upsert 频道视频完成: platform={platform}, platform_id={platform_id}, count={len(result)}")
        return result
    except Exception as e:
        db.rollback()
        logger.error(f"upsert 频道视频失败: {e}")
        raise
    finally:
        db.close()


def get_channel_videos(platform: str, platform_id: str) -> list[ChannelVideo]:
    """获取某博主的所有已缓存视频（按发布时间倒序）"""
    db = next(get_db())
    try:
        return db.query(ChannelVideo).filter_by(
            platform=platform,
            platform_id=platform_id,
        ).order_by(
            ChannelVideo.published_at.desc()
        ).all()
    finally:
        db.close()


def get_or_create_fetch_status(platform: str, platform_id: str) -> ChannelFetchStatus:
    """获取或创建分批状态记录"""
    db = next(get_db())
    try:
        status = db.query(ChannelFetchStatus).filter_by(
            platform=platform,
            platform_id=platform_id,
        ).first()

        if status:
            return status

        # 不存在则创建
        status = ChannelFetchStatus(
            platform=platform,
            platform_id=platform_id,
            total_videos=0,
            fetched_count=0,
            next_page=1,
            fetch_status="initial",
        )
        db.add(status)
        db.commit()
        db.refresh(status)
        logger.info(f"创建分批状态记录: platform={platform}, platform_id={platform_id}")
        return status
    except Exception as e:
        db.rollback()
        logger.error(f"获取/创建分批状态失败: {e}")
        raise
    finally:
        db.close()


def update_fetch_status(platform: str, platform_id: str,
                        total_videos: int = None, fetched_count: int = None,
                        next_page: int = None, next_cursor: str = None,
                        fetch_status: str = None, error_message: str = None):
    """更新分批状态的各个字段"""
    db = next(get_db())
    try:
        status = db.query(ChannelFetchStatus).filter_by(
            platform=platform,
            platform_id=platform_id,
        ).first()

        if not status:
            logger.warning(f"分批状态记录不存在: platform={platform}, platform_id={platform_id}")
            return

        if total_videos is not None:
            status.total_videos = total_videos
        if fetched_count is not None:
            status.fetched_count = fetched_count
        if next_page is not None:
            status.next_page = next_page
        if next_cursor is not None:
            status.next_cursor = next_cursor
        if fetch_status is not None:
            status.fetch_status = fetch_status
        if error_message is not None:
            status.error_message = error_message
        # 每次更新都刷新最后获取时间
        status.last_fetch_at = datetime.now()

        db.commit()
        logger.info(f"更新分批状态: platform={platform}, platform_id={platform_id}, "
                     f"status={fetch_status}, fetched={fetched_count}, total={total_videos}")
    except Exception as e:
        db.rollback()
        logger.error(f"更新分批状态失败: {e}")
        raise
    finally:
        db.close()


def get_fetch_status(platform: str, platform_id: str) -> Optional[ChannelFetchStatus]:
    """获取分批状态记录（不自动创建）"""
    db = next(get_db())
    try:
        return db.query(ChannelFetchStatus).filter_by(
            platform=platform,
            platform_id=platform_id,
        ).first()
    finally:
        db.close()


def count_channel_videos(platform: str, platform_id: str) -> int:
    """获取某博主的已缓存视频数量"""
    db = next(get_db())
    try:
        return db.query(ChannelVideo).filter_by(
            platform=platform,
            platform_id=platform_id,
        ).count()
    finally:
        db.close()
