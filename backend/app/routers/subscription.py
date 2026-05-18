"""订阅管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.services.channel_fetcher import identify_platform, fetch_all_for_subscription, parse_channel_info
from app.db.subscription_dao import upsert_feed_items
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["订阅管理"])


class SubscribeRequest(BaseModel):
    url: str


@router.get("")
async def list_subscriptions(user=Depends(get_current_user)):
    subs = subscription_dao.get_user_subscriptions(user.id)
    return R.success([{
        "id": s.id,
        "channel_url": s.channel_url,
        "channel_name": s.channel_name,
        "platform": s.platform,
        "platform_id": s.platform_id,
        "avatar_url": s.avatar_url,
        "enabled": s.enabled,
        "fetch_interval": s.fetch_interval,
        "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in subs])


@router.post("")
async def add_subscription(req: SubscribeRequest, user=Depends(get_current_user)):
    info = identify_platform(req.url)
    if not info:
        raise HTTPException(status_code=400, detail="无法识别平台或频道，请检查 URL")

    existing = subscription_dao.get_subscription_by_url(user.id, info["channel_url"])
    if existing:
        raise HTTPException(status_code=400, detail="已订阅该频道")

    # 检查是否有其他用户已订阅过该博主（复用）
    platform_id = info.get("platform_id")
    reused_sub = None
    if platform_id:
        reused_sub = subscription_dao.find_subscription_by_platform_id(info["platform"], platform_id)

    if reused_sub:
        # 复用：直接创建订阅记录，跳过抓取
        sub = subscription_dao.add_subscription(
            user_id=user.id,
            channel_url=info["channel_url"],
            platform=info["platform"],
            channel_name=reused_sub.channel_name,
            platform_id=reused_sub.platform_id,
            avatar_url=reused_sub.avatar_url,
        )
        # 复制已有的 FeedItem 到新用户
        copied = subscription_dao.copy_feed_items_to_user(reused_sub.id, user.id, sub.id)
        subscription_dao.update_subscription_check(sub.id)
        logger.info(f"订阅复用: 用户 {user.id} 复用了博主 {reused_sub.channel_name} 的数据，复制 {copied} 条动态")
    else:
        # 正常流程：获取频道详细信息并抓取
        channel_info = parse_channel_info(info["channel_url"], info["platform"])

        sub = subscription_dao.add_subscription(
            user_id=user.id,
            channel_url=info["channel_url"],
            platform=info["platform"],
            channel_name=channel_info.get("channel_name") or info.get("channel_name"),
            platform_id=info.get("platform_id"),
            avatar_url=channel_info.get("avatar_url"),
        )

        # 立即获取初始数据
        items = fetch_all_for_subscription(sub, limit=20)
        if items:
            upsert_feed_items(items)
        subscription_dao.update_subscription_check(sub.id)

    return R.success({
        "id": sub.id,
        "channel_name": sub.channel_name,
        "platform": sub.platform,
    })


@router.delete("/{sub_id}")
async def delete_subscription(sub_id: int, user=Depends(get_current_user)):
    subscription_dao.remove_subscription(sub_id, user.id)
    return R.success(msg="已取消订阅")


@router.put("/{sub_id}/toggle")
async def toggle_subscription(sub_id: int, user=Depends(get_current_user)):
    sub = subscription_dao.toggle_subscription(sub_id, user.id)
    if not sub:
        raise HTTPException(status_code=404, detail="订阅不存在")
    return R.success({"enabled": sub.enabled})


@router.post("/{sub_id}/refresh")
async def refresh_subscription(sub_id: int, user=Depends(get_current_user)):
    subs = subscription_dao.get_user_subscriptions(user.id)
    sub = next((s for s in subs if s.id == sub_id), None)
    if not sub:
        raise HTTPException(status_code=404, detail="订阅不存在")
    # B站获取全部视频，其他平台获取 50 条
    limit = None if sub.platform == "bilibili" else 50
    items = fetch_all_for_subscription(sub, limit=limit)
    added = upsert_feed_items(items) if items else 0
    subscription_dao.update_subscription_check(sub_id)
    return R.success({"added": added, "total": len(items) if items else 0})