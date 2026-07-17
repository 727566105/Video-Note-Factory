"""动态内容 API"""
import json
from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.db.video_task_dao import find_completed_task_by_video, get_task_by_video
from app.services.channel_fetcher import fetch_all_for_subscription
from app.db.subscription_dao import upsert_feed_items
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/feed", tags=["动态内容"])


@router.get("")
async def list_feed(limit: int = 20, offset: int = 0, type: str = None,
                    order: str = "desc",
                    user=Depends(get_current_user)) -> dict:
    items = subscription_dao.get_feed_items(user.id, limit, offset, type, order)
    items_data = []
    for f in items:
        # 检查笔记可用性：优先用 feed_item 关联的 task_id，否则查当前用户的任务
        available_task_id = f.task_id
        if not available_task_id and f.content_id:
            # 只查当前用户的已完成任务，不跨用户
            existing_task_id = get_task_by_video(f.content_id, f.platform, user.id)
            if existing_task_id:
                available_task_id = existing_task_id
        items_data.append({
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
            "note_available": bool(available_task_id),
            "available_task_id": available_task_id,
        })
    return R.success(items_data)


@router.put("/{item_id}/read")
async def mark_item_read(item_id: int, user=Depends(get_current_user)) -> dict:
    subscription_dao.mark_read(user.id, item_id)
    return R.success(msg="已标记为已读")


@router.put("/read-all")
async def mark_all_read(user=Depends(get_current_user)) -> dict:
    subscription_dao.mark_all_read(user.id)
    return R.success(msg="已全部标记为已读")


@router.post("/refresh")
async def refresh_feed(user=Depends(get_current_user)) -> dict:
    subs = subscription_dao.get_user_subscriptions(user.id)
    total_added = 0
    errors = []
    for sub in subs:
        if sub.enabled != 1:
            continue
        try:
            result = fetch_all_for_subscription(sub, limit=20)
            added = len(upsert_feed_items(result.items)) if result.items else 0
            total_added += added
            new_last_content_id = result.items[0].get("content_id") if result.items else None
            if result.error:
                errors.append(f"{sub.channel_name}: {result.error}")
                status = "cookie_expired" if "Cookie" in result.error else "failed"
                subscription_dao.update_fetch_result(sub.id, status, added, result.error, new_last_content_id)
            else:
                subscription_dao.update_fetch_result(sub.id, "success" if added > 0 else "empty", added, None, new_last_content_id)
        except Exception as e:
            errors.append(f"{sub.channel_name}: {str(e)}")
            subscription_dao.update_fetch_result(sub.id, "failed", 0, str(e), None)

    response = {"added": total_added}
    if errors:
        response["error"] = "; ".join(errors)
    return R.success(response)


@router.get("/unread-count")
async def unread_count(user=Depends(get_current_user)) -> dict:
    count = subscription_dao.get_unread_count(user.id)
    return R.success({"count": count})


@router.post("/{item_id}/generate-note")
async def generate_article_note(item_id: int, user=Depends(get_current_user)) -> dict:
    item = subscription_dao.get_feed_item_by_id(item_id, user.id)
    if not item:
        raise HTTPException(status_code=404, detail="动态不存在")
    if item.content_type != "article":
        raise HTTPException(status_code=400, detail="仅图文内容支持此操作，视频请使用首页生成")

    images = json.loads(item.images) if item.images else []

    from app.services.note import NoteGenerator
    generator = NoteGenerator()
    markdown, smart_info = generator.generate_article_note(
        title=item.title,
        author=item.author,
        description=item.description,
        images=images,
        smart_mode=True,
        user_id=user.id,
    )

    result = {"markdown": markdown}
    if smart_info:
        result["used_model_name"] = f"{smart_info['provider_name']}/{smart_info['model_name']}"
        result["smart_switched"] = smart_info["switched"]

    return R.success(result)