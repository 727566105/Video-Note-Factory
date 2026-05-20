"""频道信息 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.services.channel_fetcher import identify_platform, parse_channel_info, fetch_videos
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/channels", tags=["频道信息"])


class ParseUrlRequest(BaseModel):
    url: str


@router.get("/summarized")
async def get_summarized_channels(user=Depends(get_current_user)):
    channels = subscription_dao.get_summarized_channels(user.id)
    return R.success(channels)


@router.post("/parse-url")
async def parse_url(req: ParseUrlRequest, user=Depends(get_current_user)):
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
                              user=Depends(get_current_user)):
    # 先找订阅获取 subscription_id
    channel_url_map = {
        "bilibili": f"https://space.bilibili.com/{platform_id}",
        "youtube": f"https://www.youtube.com/channel/{platform_id}",
        "douyin": f"https://www.douyin.com/user/{platform_id}",
    }
    channel_url = channel_url_map.get(platform, "")
    sub = subscription_dao.get_subscription_by_url(user.id, channel_url) if channel_url else None
    sub_id = sub.id if sub else None

    # 如果有订阅，从缓存的 feed_items 读取；否则实时获取
    if sub_id:
        items = subscription_dao.get_feed_items_by_subscription(sub_id, limit, offset)
        total = subscription_dao.count_feed_items_by_subscription(sub_id)
    else:
        result = fetch_videos(channel_url, platform, limit)
        return R.success({"items": result.items, "total": len(result.items)})

    return R.success({
        "items": [{
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
        } for f in items],
        "total": total,
    })