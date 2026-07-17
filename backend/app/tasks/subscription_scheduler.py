"""订阅调度管理器 — 为每个订阅动态创建 APScheduler 任务"""
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.db.subscription_dao import get_all_enabled_subscriptions, upsert_feed_items
from app.services.channel_fetcher import fetch_all_for_subscription
from app.db.models.subscriptions import Subscription
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 预设间隔选项
FETCH_INTERVAL_OPTIONS = {
    "高频": [
        {"label": "每3分钟", "value": 3},
        {"label": "每5分钟", "value": 5},
        {"label": "每10分钟", "value": 10},
    ],
    "中频": [
        {"label": "每15分钟", "value": 15},
        {"label": "每30分钟", "value": 30},
    ],
    "低频": [
        {"label": "每1小时", "value": 60},
        {"label": "每2小时", "value": 120},
        {"label": "每6小时", "value": 360},
        {"label": "每12小时", "value": 720},
    ],
    "周期": [
        {"label": "每天", "value": 1440},
        {"label": "每周", "value": 10080},
        {"label": "每月", "value": 43200},
    ],
}

PERIODIC_THRESHOLD = 1440


class SubscriptionScheduler:
    """订阅定时刷新调度器"""

    def __init__(self, scheduler: BackgroundScheduler):
        self.scheduler = scheduler

    def _job_id(self, subscription_id: int) -> str:
        return f"sub_fetch_{subscription_id}"

    def _fetch_job(self, subscription_id: int, platform: str, platform_id: Optional[str], channel_name: str):
        """单个订阅的刷新任务"""
        try:
            from app.db.subscription_dao import (
                get_subscription_by_id, update_fetch_result,
                create_feed_items_from_channel_videos_with_records,
            )
            from app.db.channel_video_dao import get_channel_videos
            sub = get_subscription_by_id(subscription_id)
            if not sub or sub.enabled != 1:
                logger.info(f"订阅 {subscription_id} 已禁用或不存在，跳过刷新")
                return

            logger.info(f"开始刷新订阅 {subscription_id} ({channel_name})")
            result = fetch_all_for_subscription(sub, limit=50)

            # 增量截断：所有平台列表"最新在前"，遇到 last_content_id 为止都算新
            fetched_items = result.items or []
            new_content_ids = self._truncate_by_cursor(fetched_items, sub.last_content_id)

            # 查出对应的 ChannelVideo 记录，走共享缓存两步路径（与手动刷新统一）
            new_feed_items = []
            added = 0
            if platform_id and new_content_ids:
                try:
                    all_cv = get_channel_videos(platform, platform_id)
                    new_cv = [cv for cv in all_cv if cv.content_id in new_content_ids]
                    if new_cv:
                        added, new_feed_items = create_feed_items_from_channel_videos_with_records(
                            sub.user_id, sub.id, new_cv, platform
                        )
                except Exception as e:
                    logger.warning(f"订阅 {subscription_id} 共享缓存 feed_items 创建失败，回退 upsert: {e}")
                    # 回退：用 upsert_feed_items 保证不丢内容
                    from app.db.subscription_dao import upsert_feed_items
                    fallback_items = [it for it in fetched_items if it.get("content_id") in new_content_ids]
                    new_feed_items = upsert_feed_items(fallback_items) if fallback_items else []
                    added = len(new_feed_items)
            elif new_content_ids and not platform_id:
                # 无 platform_id（理论不应发生），回退旧路径
                from app.db.subscription_dao import upsert_feed_items
                fallback_items = [it for it in fetched_items if it.get("content_id") in new_content_ids]
                new_feed_items = upsert_feed_items(fallback_items) if fallback_items else []
                added = len(new_feed_items)

            logger.info(f"订阅 {subscription_id} 新增 {added} 条动态")

            # 回写增量游标（取本次拉到的最新 content_id）
            new_last_content_id = fetched_items[0].get("content_id") if fetched_items else None

            # 写可观测性字段（四态）
            if result.error:
                status = "cookie_expired" if "Cookie" in (result.error or "") else "failed"
                update_fetch_result(subscription_id, status, added, result.error, new_last_content_id)
                logger.warning(f"订阅 {subscription_id} 刷新失败: {result.error}")
            elif added == 0:
                update_fetch_result(subscription_id, "empty", 0, None, new_last_content_id)
            else:
                update_fetch_result(subscription_id, "success", added, None, new_last_content_id)

            # 自动生成笔记：订阅开启了 auto_generate 且有新内容
            if new_feed_items and getattr(sub, 'auto_generate', 0) == 1:
                self._auto_generate_notes(sub, new_feed_items)

        except Exception as e:
            logger.error(f"订阅 {subscription_id} 刷新异常: {e}")
            try:
                from app.db.subscription_dao import update_fetch_result
                update_fetch_result(subscription_id, "failed", 0, str(e), None)
            except Exception:
                pass

    @staticmethod
    def _truncate_by_cursor(items: list, last_content_id: Optional[str]) -> set:
        """增量截断：所有平台列表"最新在前"，从头扫到遇到 last_content_id 为止算新。

        :return: 新内容的 content_id 集合（供后续查 ChannelVideo 过滤用）
        """
        if not items:
            return set()
        if not last_content_id:
            # 首次拉取（无游标），全部当新，靠 upsert 兜底去重
            return {it.get("content_id") for it in items if it.get("content_id")}
        new_ids = set()
        for it in items:
            cid = it.get("content_id")
            if not cid:
                continue
            if cid == last_content_id:
                break  # 遇到上次最新一条，之后的都是旧内容
            new_ids.add(cid)
        # 若 last_content_id 不在本次列表（博主删了那条 / 列表只返回最新N条），
        # new_ids 会包含全部，靠 upsert 兜底去重，这是"安全的退化"
        return new_ids

    def _auto_generate_notes(self, subscription, new_items: list):
        """为新增的 feed items 自动生成笔记

        :param new_items: FeedItem 对象列表（来自 create_feed_items_from_channel_videos_with_records
                          或 upsert_feed_items 的返回）
        """
        import uuid
        from app.services.task_queue import task_queue
        from app.routers.note import run_note_task, _save_queued_task_params
        from app.db.subscription_dao import update_feed_item_task

        style = getattr(subscription, 'generate_style', None) or 'minimal'
        generated = 0

        for item in new_items:
            # item 可能是 FeedItem 对象或 dict（回退路径）
            if hasattr(item, 'task_id'):
                task_id_existing = item.task_id
                content_url = item.content_url
                content_id = item.content_id
                item_id = item.id
            else:
                task_id_existing = item.get('task_id')
                content_url = item.get('content_url')
                content_id = item.get('content_id')
                item_id = item.get('id')

            if task_id_existing:
                continue
            if not content_url:
                continue

            # 去重：检查该用户是否已有该视频的笔记（未删除的），避免重复生成
            from app.db.video_task_dao import get_user_task_for_video
            existing = get_user_task_for_video(content_id, subscription.platform, subscription.user_id)
            if existing and existing.deleted_at is None:
                # 已有笔记，回写 task_id 到 feed item 并跳过
                if item_id:
                    update_feed_item_task(item_id, existing.task_id)
                logger.info(f"[自动生成] 订阅 {subscription.id} 内容 {content_id} 已有笔记，跳过")
                continue

            task_id = str(uuid.uuid4())
            logger.info(f"[自动生成] 订阅 {subscription.id} 新内容 {content_id} -> task_id={task_id}")

            try:
                from app.db.video_task_dao import insert_video_task
                from app.routers.note import VideoRequest

                # 创建任务记录
                insert_video_task(
                    video_id=content_id,
                    platform=subscription.platform,
                    task_id=task_id,
                    video_url=content_url,
                    user_id=subscription.user_id,
                    note_style=style,
                )

                # 抢占执行槽位
                acquired = task_queue.acquire(task_id)
                if acquired:
                    # 直接在后台线程执行
                    import threading
                    thread = threading.Thread(
                        target=run_note_task,
                        args=(task_id,),
                        kwargs={
                            'video_url': content_url,
                            'platform': subscription.platform,
                            'quality': 'medium',
                            'smart_mode': True,
                            'style': style,
                            'user_id': subscription.user_id,
                        },
                        daemon=True,
                    )
                    thread.start()
                    generated += 1
                else:
                    # 排队，保存参数
                    from app.enmus.note_enums import DownloadQuality
                    queued_req = VideoRequest(
                        video_url=content_url,
                        platform=subscription.platform,
                        quality=DownloadQuality('medium'),
                        smart_mode=True,
                        style=style,
                        model_name='',  # smart_mode 不需要
                        provider_id='',
                    )
                    _save_queued_task_params(task_id, queued_req, subscription.user_id)

                # 回写 task_id 到 feed item
                if item_id:
                    update_feed_item_task(item_id, task_id)

            except Exception as e:
                logger.error(f"[自动生成] 订阅 {subscription.id} 内容 {content_id} 生成失败: {e}")

        if generated:
            logger.info(f"[自动生成] 订阅 {subscription.id} 共触发 {generated} 条笔记生成")

    def add_job(self, subscription: Subscription):
        """为订阅创建定时任务"""
        job_id = self._job_id(subscription.id)

        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

        interval = subscription.fetch_interval or 60
        hour = subscription.fetch_at_hour or 3
        day = subscription.fetch_at_day

        if interval >= PERIODIC_THRESHOLD:
            if interval == 1440:  # 每天
                trigger = CronTrigger(hour=hour, minute=0)
                logger.info(f"创建任务 {job_id}: 每天 {hour:02d}:00 刷新")
            elif interval == 10080:  # 每周
                dow_map = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
                dow = dow_map[day] if day and 0 <= day <= 6 else 'mon'
                trigger = CronTrigger(day_of_week=dow, hour=hour, minute=0)
                logger.info(f"创建任务 {job_id}: 每周{dow} {hour:02d}:00 刷新")
            elif interval == 43200:  # 每月
                dom = day if day and 1 <= day <= 28 else 1
                trigger = CronTrigger(day=dom, hour=hour, minute=0)
                logger.info(f"创建任务 {job_id}: 每月{dom}号 {hour:02d}:00 刷新")
            else:
                trigger = IntervalTrigger(minutes=interval)
                logger.info(f"创建任务 {job_id}: 每 {interval} 分钟刷新")
        else:
            trigger = IntervalTrigger(minutes=interval)
            logger.info(f"创建任务 {job_id}: 每 {interval} 分钟刷新")

        self.scheduler.add_job(
            self._fetch_job,
            trigger=trigger,
            id=job_id,
            name=f"订阅刷新-{subscription.channel_name}",
            args=[subscription.id, subscription.platform, subscription.platform_id, subscription.channel_name],
            replace_existing=True,
        )

    def remove_job(self, subscription_id: int):
        """移除订阅的定时任务"""
        job_id = self._job_id(subscription_id)
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"移除任务 {job_id}")

    def reschedule_job(self, subscription: Subscription):
        """重新调度订阅任务"""
        if subscription.enabled == 1:
            self.add_job(subscription)
        else:
            self.remove_job(subscription.id)

    def startup(self):
        """启动时加载所有启用的订阅"""
        subs = get_all_enabled_subscriptions()
        logger.info(f"SubscriptionScheduler 启动，加载 {len(subs)} 个订阅任务")
        for sub in subs:
            self.add_job(sub)

    def shutdown(self):
        """清理所有订阅任务"""
        jobs = self.scheduler.get_jobs()
        for job in jobs:
            if job.id.startswith("sub_fetch_"):
                self.scheduler.remove_job(job.id)
        logger.info("SubscriptionScheduler 已清理所有订阅任务")


# 全局实例
subscription_scheduler: Optional[SubscriptionScheduler] = None


def get_subscription_scheduler() -> SubscriptionScheduler:
    if subscription_scheduler is None:
        raise RuntimeError("SubscriptionScheduler 未初始化")
    return subscription_scheduler


def init_subscription_scheduler(scheduler: BackgroundScheduler):
    global subscription_scheduler
    subscription_scheduler = SubscriptionScheduler(scheduler)
    subscription_scheduler.startup()
