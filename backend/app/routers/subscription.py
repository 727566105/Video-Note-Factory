"""订阅管理 API"""
import threading
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.dependencies import get_current_user
from app.db import subscription_dao
from app.services.channel_fetcher import identify_platform, fetch_all_for_subscription, parse_channel_info
from app.db.subscription_dao import upsert_feed_items, get_channel_stats
from app.db.channel_video_dao import get_or_create_fetch_status, get_channel_videos, count_channel_videos
from app.services.channel_fetch_queue import channel_fetch_queue
from app.services.fetch_progress import create_progress, get_progress, update_progress, complete_progress
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["订阅管理"])


class SubscribeRequest(BaseModel):
    url: str


@router.get("")
async def list_subscriptions(user=Depends(get_current_user)) -> dict:
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
async def add_subscription(req: SubscribeRequest, user=Depends(get_current_user)) -> dict:
    info = identify_platform(req.url)
    if not info:
        raise HTTPException(status_code=400, detail="无法识别平台或频道，请检查 URL")

    existing = subscription_dao.get_subscription_by_url(user.id, info["channel_url"])
    if existing:
        raise HTTPException(status_code=400, detail="已订阅该频道")

    platform_id = info.get("platform_id")

    # ── 复用分支：其他用户已订阅过该博主 ──
    reused_sub = None
    if platform_id:
        reused_sub = subscription_dao.find_subscription_by_platform_id(info["platform"], platform_id)

    if reused_sub:
        # 复用：先创建当前用户的订阅记录
        sub = subscription_dao.add_subscription(
            user_id=user.id,
            channel_url=info["channel_url"],
            platform=info["platform"],
            channel_name=reused_sub.channel_name,
            platform_id=reused_sub.platform_id,
            avatar_url=reused_sub.avatar_url,
        )

        # 尝试从共享缓存表 channel_videos 直接复制（零 API 调用）
        cached_count = count_channel_videos(info["platform"], reused_sub.platform_id) if reused_sub.platform_id else 0
        if cached_count > 0:
            # 有缓存 → 从 channel_videos 创建 feed_items
            existing_videos = get_channel_videos(info["platform"], reused_sub.platform_id)
            subscription_dao.create_feed_items_from_channel_videos(user.id, sub.id, existing_videos, info["platform"])
            subscription_dao.update_subscription_check(sub.id)
            logger.info(f"订阅复用(缓存命中): 用户 {user.id} 复用了博主 {reused_sub.channel_name} 的缓存，共 {len(existing_videos)} 个视频")

            # 统计该用户实际的 feed_items 数量
            actual_count = subscription_dao.count_feed_items_by_subscription(sub.id)
            stats_hint = get_channel_stats(info["platform"], reused_sub.platform_id) if reused_sub.platform_id else None

            resp = {
                "id": sub.id,
                "channel_name": sub.channel_name,
                "platform": sub.platform,
                "items_count": actual_count,
                "fetch_status": "success",
            }
            if stats_hint:
                resp["stats_hint"] = stats_hint
            return R.success(resp)

        # 缓存未命中 → 尝试复制已有 feed_items（旧逻辑兜底）
        copied = subscription_dao.copy_feed_items_to_user(reused_sub.id, user.id, sub.id)
        subscription_dao.update_subscription_check(sub.id)
        logger.info(f"订阅复用(feed_items复制): 用户 {user.id} 复制了 {copied} 条动态")

        if copied > 0:
            stats_hint = get_channel_stats(info["platform"], reused_sub.platform_id) if reused_sub.platform_id else None
            resp = {
                "id": sub.id,
                "channel_name": sub.channel_name,
                "platform": sub.platform,
                "items_count": copied,
                "fetch_status": "success",
            }
            if stats_hint:
                resp["stats_hint"] = stats_hint
            return R.success(resp)

        # 复用数据为空 → 加入串行队列获取
        if reused_sub.platform_id:
            channel_fetch_queue.enqueue(info["platform"], reused_sub.platform_id, user.id, sub.id)
            logger.info(f"订阅复用(无数据): 已加入串行队列获取 {reused_sub.channel_name} 的视频")
            resp = {
                "id": sub.id,
                "channel_name": sub.channel_name,
                "platform": sub.platform,
                "items_count": 0,
                "fetch_status": "queued",
                "warning": "正在获取视频列表，请稍后刷新查看",
            }
            return R.success(resp)

        # 没有 platform_id，走旧逻辑兜底
        result = fetch_all_for_subscription(sub, limit=20)
        added = upsert_feed_items(result.items) if result.items else 0
        response_data = {
            "id": sub.id,
            "channel_name": sub.channel_name,
            "platform": sub.platform,
            "items_count": added,
        }
        if result.error:
            response_data["fetch_status"] = "failed"
            response_data["warning"] = f"获取内容失败: {result.error}"
        elif added == 0:
            response_data["fetch_status"] = "empty"
            response_data["warning"] = "该博主暂无可获取的内容"
        else:
            response_data["fetch_status"] = "success"
        return R.success(response_data)

    # ── 正常分支：首次订阅该博主 ──
    channel_info = parse_channel_info(info["channel_url"], info["platform"])

    sub = subscription_dao.add_subscription(
        user_id=user.id,
        channel_url=info["channel_url"],
        platform=info["platform"],
        channel_name=channel_info.get("channel_name") or info.get("channel_name"),
        platform_id=info.get("platform_id"),
        avatar_url=channel_info.get("avatar_url"),
    )

    # 检查共享缓存表是否已有该博主的视频
    sub_platform_id = sub.platform_id or platform_id
    if sub_platform_id:
        cached_count = count_channel_videos(info["platform"], sub_platform_id)
        if cached_count > 0:
            # 有缓存 → 直接复制，零 API 调用
            existing_videos = get_channel_videos(info["platform"], sub_platform_id)
            subscription_dao.create_feed_items_from_channel_videos(user.id, sub.id, existing_videos, info["platform"])
            subscription_dao.update_subscription_check(sub.id)
            actual_count = subscription_dao.count_feed_items_by_subscription(sub.id)
            logger.info(f"首次订阅(缓存命中): {sub.channel_name}, 缓存 {len(existing_videos)} 个视频")

            stats_hint = get_channel_stats(info["platform"], sub_platform_id)
            resp = {
                "id": sub.id,
                "channel_name": sub.channel_name,
                "platform": sub.platform,
                "items_count": actual_count,
                "fetch_status": "success",
            }
            if stats_hint:
                resp["stats_hint"] = stats_hint
            return R.success(resp)

        # 无缓存 → 加入串行队列，首批获取约 30 条
        get_or_create_fetch_status(info["platform"], sub_platform_id)
        channel_fetch_queue.enqueue(info["platform"], sub_platform_id, user.id, sub.id)
        subscription_dao.update_subscription_check(sub.id)
        logger.info(f"首次订阅(加入队列): {sub.channel_name}, platform_id={sub_platform_id}")

        stats_hint = get_channel_stats(info["platform"], sub_platform_id)
        resp = {
            "id": sub.id,
            "channel_name": sub.channel_name,
            "platform": sub.platform,
            "items_count": 0,
            "fetch_status": "queued",
            "warning": "正在获取视频列表，请稍后刷新查看",
        }
        if stats_hint:
            resp["stats_hint"] = stats_hint
        return R.success(resp)

    # 没有 platform_id，走旧逻辑兜底（直接获取）
    result = fetch_all_for_subscription(sub, limit=20)
    added = 0
    if result.items:
        added = upsert_feed_items(result.items)
    subscription_dao.update_subscription_check(sub.id)

    response_data = {
        "id": sub.id,
        "channel_name": sub.channel_name,
        "platform": sub.platform,
        "items_count": added,
    }

    if result.error:
        response_data["fetch_status"] = "failed"
        response_data["warning"] = f"获取内容失败: {result.error}"
        logger.warning(f"订阅 {sub.id} 初始获取失败: {result.error}")
    elif added == 0:
        response_data["fetch_status"] = "empty"
        response_data["warning"] = "该博主暂无可获取的内容"
    else:
        response_data["fetch_status"] = "success"

    if sub.platform_id:
        stats = get_channel_stats(sub.platform, sub.platform_id)
        if stats:
            response_data["stats_hint"] = stats

    return R.success(response_data)


@router.delete("/{sub_id}")
async def delete_subscription(sub_id: int, user=Depends(get_current_user)) -> dict:
    subscription_dao.remove_subscription(sub_id, user.id)
    return R.success(msg="已取消订阅")


@router.put("/{sub_id}/toggle")
async def toggle_subscription(sub_id: int, user=Depends(get_current_user)) -> dict:
    sub = subscription_dao.toggle_subscription(sub_id, user.id)
    if not sub:
        raise HTTPException(status_code=404, detail="订阅不存在")
    return R.success({"enabled": sub.enabled})


@router.post("/{sub_id}/refresh")
async def refresh_subscription(sub_id: int, user=Depends(get_current_user)) -> dict:
    """启动异步刷新任务，返回 progress_id"""
    subs = subscription_dao.get_user_subscriptions(user.id)
    sub = next((s for s in subs if s.id == sub_id), None)
    if not sub:
        raise HTTPException(status_code=404, detail="订阅不存在")

    progress_id = create_progress(sub_id)

    def _do_fetch():
        """后台线程执行刷新"""
        try:
            limit = None if sub.platform == "bilibili" else 50

            def _progress_cb(page, fetched):
                update_progress(progress_id, current_page=page, fetched_count=fetched)

            result = fetch_all_for_subscription(sub, limit=limit, progress_callback=_progress_cb)
            added = upsert_feed_items(result.items) if result.items else 0
            subscription_dao.update_subscription_check(sub_id)
            db_total = subscription_dao.count_feed_items_by_subscription(sub_id)

            if result.error:
                complete_progress(progress_id, added, db_total, error=result.error)
                logger.warning(f"订阅 {sub_id} 刷新失败: {result.error}")
            else:
                complete_progress(progress_id, added, db_total)

        except Exception as e:
            complete_progress(progress_id, 0, 0, error=str(e))
            logger.error(f"订阅 {sub_id} 刷新异常: {e}")

    thread = threading.Thread(target=_do_fetch, daemon=True)
    thread.start()

    return R.success({"progress_id": progress_id, "status": "running"})


@router.get("/progress/{progress_id}")
async def get_refresh_progress(progress_id: str, user=Depends(get_current_user)) -> dict:
    """查询刷新进度"""
    progress = get_progress(progress_id)
    if not progress:
        raise HTTPException(status_code=404, detail="进度不存在或已过期")
    return R.success(progress)
