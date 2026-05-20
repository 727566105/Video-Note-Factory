"""频道信息 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.db.engine import get_db
from app.db.video_task_dao import find_completed_task_by_video
from app.services.channel_fetcher import identify_platform, parse_channel_info, fetch_videos
from app.services.constant import CHANNEL_URL_MAP
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/channels", tags=["频道信息"])


class ParseUrlRequest(BaseModel):
    url: str


@router.get("/summarized")
async def get_summarized_channels(user=Depends(get_current_user)) -> dict:
    channels = subscription_dao.get_summarized_channels(user.id)
    return R.success(channels)


@router.post("/parse-url")
async def parse_url(req: ParseUrlRequest, user=Depends(get_current_user)) -> dict:
    info = identify_platform(req.url)
    if not info:
        raise HTTPException(status_code=400, detail="无法识别平台或频道")

    channel_info = parse_channel_info(info["channel_url"], info["platform"])
    return R.success({
        "platform": info["platform"],
        "platform_id": info.get("platform_id"),
        "channel_url": info["channel_url"],
        "channel_name": channel_info.get("channel_name"),
        "avatar_url": channel_info.get("avatar_url"),
    })


@router.get("/{platform}/{platform_id}/videos")
async def get_channel_videos(platform: str, platform_id: str, limit: int = 20, offset: int = 0,
                              user=Depends(get_current_user)) -> dict:
    # 先找订阅获取 subscription_id
    channel_url = CHANNEL_URL_MAP.get(platform, "").format(platform_id=platform_id)
    sub = subscription_dao.get_subscription_by_url(user.id, channel_url) if channel_url else None
    sub_id = sub.id if sub else None

    # 如果有订阅，从缓存的 feed_items 读取；否则实时获取
    if sub_id:
        items = subscription_dao.get_feed_items_by_subscription(sub_id, limit, offset)
        total = subscription_dao.count_feed_items_by_subscription(sub_id)
    else:
        result = fetch_videos(channel_url, platform, limit)
        return R.success({"items": result.items, "total": len(result.items)})

    items_data = []
    for f in items:
        # 检查笔记可用性：优先用 feed_item 关联的 task_id，否则跨用户查找
        available_task_id = f.task_id
        if not available_task_id and f.content_id:
            existing = find_completed_task_by_video(f.content_id, platform)
            if existing:
                available_task_id = existing.task_id
        items_data.append({
            "id": f.id,
            "content_id": f.content_id,
            "content_url": f.content_url,
            "title": f.title,
            "cover_url": f.cover_url,
            "duration": f.duration,
            "author": f.author,
            "published_at": f.published_at.isoformat() if f.published_at else None,
            "is_read": f.is_read,
            "task_id": f.task_id,
            "note_available": bool(available_task_id),
            "available_task_id": available_task_id,
        })

    return R.success({
        "items": items_data,
        "total": total,
    })


@router.get("/{platform}/{platform_id}/subscribers")
async def get_channel_subscribers(platform: str, platform_id: str, user=Depends(get_current_user)) -> dict:
    """获取频道订阅者列表"""
    db = next(get_db())
    try:
        from app.db.models.subscriptions import Subscription
        from app.db.models.users import User
        subs = db.query(Subscription).filter_by(
            platform=platform, platform_id=platform_id
        ).all()
        user_ids = [s.user_id for s in subs]
        users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        return R.success({
            "subscribers": [{"user_id": u.id, "username": u.username} for u in users],
            "total": len(users),
        })
    finally:
        db.close()