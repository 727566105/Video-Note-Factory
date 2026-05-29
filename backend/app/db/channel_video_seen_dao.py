"""用户已查看频道视频 DAO"""
from typing import Set

from sqlalchemy import exists

from app.db.engine import get_db
from app.db.models.channel_video_seen import ChannelVideoSeen
from app.db.models.channel_video import ChannelVideo
from app.utils.logger import get_logger

logger = get_logger(__name__)


def mark_seen(user_id: int, channel_video_id: int):
    """标记用户已查看某个频道视频"""
    db = next(get_db())
    try:
        existing = db.query(ChannelVideoSeen).filter_by(
            user_id=user_id,
            channel_video_id=channel_video_id,
        ).first()
        if not existing:
            record = ChannelVideoSeen(user_id=user_id, channel_video_id=channel_video_id)
            db.add(record)
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"标记视频已查看失败: {e}")
    finally:
        db.close()


def get_seen_ids(user_id: int, platform: str, platform_id: str) -> Set[int]:
    """获取用户在指定频道中已查看的 ChannelVideo ID 集合"""
    db = next(get_db())
    try:
        rows = db.query(ChannelVideoSeen.channel_video_id).join(
            ChannelVideo, ChannelVideo.id == ChannelVideoSeen.channel_video_id
        ).filter(
            ChannelVideoSeen.user_id == user_id,
            ChannelVideo.platform == platform,
            ChannelVideo.platform_id == platform_id,
        ).all()
        return {row[0] for row in rows}
    finally:
        db.close()
