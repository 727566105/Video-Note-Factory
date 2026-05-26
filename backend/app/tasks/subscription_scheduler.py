"""订阅调度管理器 — 为每个订阅动态创建 APScheduler 任务"""
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.db.subscription_dao import get_all_enabled_subscriptions, upsert_feed_items, update_subscription_check
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
            from app.db.subscription_dao import get_subscription_by_id
            sub = get_subscription_by_id(subscription_id)
            if not sub or sub.enabled != 1:
                logger.info(f"订阅 {subscription_id} 已禁用或不存在，跳过刷新")
                return

            logger.info(f"开始刷新订阅 {subscription_id} ({channel_name})")
            result = fetch_all_for_subscription(sub, limit=50)

            if result.items:
                added = upsert_feed_items(result.items)
                logger.info(f"订阅 {subscription_id} 新增 {added} 条动态")

            if result.error:
                logger.warning(f"订阅 {subscription_id} 刷新失败: {result.error}")

            update_subscription_check(subscription_id)
        except Exception as e:
            logger.error(f"订阅 {subscription_id} 刷新异常: {e}")

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
