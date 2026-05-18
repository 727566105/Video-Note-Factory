"""动态内容 API"""
import json
from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.services.channel_fetcher import fetch_all_for_subscription
from app.db.subscription_dao import upsert_feed_items
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/feed", tags=["动态内容"])


@router.get("")
async def list_feed(limit: int = 20, offset: int = 0, type: str = None,
                    user=Depends(get_current_user)):
    items = subscription_dao.get_feed_items(user.id, limit, offset, type)
    return R.success([{
        "id": f.id,
        "subscription_id": f.subscription_id,
        "platform": f.platform,
        "content_type": f.content_type,
        "content_id": f.content_id,
        "content_url": f.content_url,
        "title": f.title,
        "cover_url": f.cover_url,
        "images": f.images,
        "duration": f.duration,
        "author": f.author,
        "description": f.description,
        "published_at": f.published_at.isoformat() if f.published_at else None,
        "is_read": f.is_read,
        "task_id": f.task_id,
    } for f in items])


@router.put("/{item_id}/read")
async def mark_item_read(item_id: int, user=Depends(get_current_user)):
    subscription_dao.mark_read(user.id, item_id)
    return R.success(msg="已标记为已读")


@router.put("/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    subscription_dao.mark_all_read(user.id)
    return R.success(msg="已全部标记为已读")


@router.post("/refresh")
async def refresh_feed(user=Depends(get_current_user)):
    subs = subscription_dao.get_user_subscriptions(user.id)
    total_added = 0
    for sub in subs:
        if sub.enabled != 1:
            continue
        items = fetch_all_for_subscription(sub, limit=20)
        if items:
            total_added += upsert_feed_items(items)
        subscription_dao.update_subscription_check(sub.id)
    return R.success({"added": total_added})


@router.get("/unread-count")
async def unread_count(user=Depends(get_current_user)):
    count = subscription_dao.get_unread_count(user.id)
    return R.success({"count": count})


@router.post("/{item_id}/generate-note")
async def generate_article_note(item_id: int, user=Depends(get_current_user)):
    item = subscription_dao.get_feed_item_by_id(item_id, user.id)
    if not item:
        raise HTTPException(status_code=404, detail="动态不存在")
    if item.content_type != "article":
        raise HTTPException(status_code=400, detail="仅图文内容支持此操作，视频请使用首页生成")

    images = json.loads(item.images) if item.images else []

    from app.services.note import NoteGenerator
    generator = NoteGenerator()
    markdown = generator.generate_article_note(
        title=item.title,
        author=item.author,
        description=item.description,
        images=images,
    )
    return R.success({"markdown": markdown})