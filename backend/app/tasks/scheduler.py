"""定时任务调度器"""
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

from app.db.webdav_config_dao import get_config
from app.services.webdav_backup import WebDAVBackup, acquire_backup_lock, release_backup_lock
from app.services.cache_cleaner import cache_cleaner_job, CACHE_TTL_DAYS
from app.utils.path_helper import cleanup_stale_pending
from app.utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

# 全局调度器实例
scheduler = BackgroundScheduler()

# 缓存清理定时配置（Cron 表达式，默认每天凌晨 3 点执行）
CACHE_CLEAN_SCHEDULE = os.getenv("CACHE_CLEAN_SCHEDULE", "0 3 * * *")

# 任务看门狗配置：每 5 分钟检查一次，15 分钟无心跳视为卡死
WATCHDOG_INTERVAL_MINUTES = int(os.getenv("WATCHDOG_INTERVAL_MINUTES", "5"))
WATCHDOG_TASK_TIMEOUT_SECONDS = int(os.getenv("WATCHDOG_TASK_TIMEOUT_SECONDS", "900"))


def backup_job():
    """定时备份任务"""
    try:
        logger.info("Scheduled backup task started")

        # 获取配置
        config = get_config()
        if not config:
            logger.warning("No WebDAV config found, skipping scheduled backup")
            return

        # 检查是否启用自动备份
        if config.auto_backup_enabled != 1:
            logger.info("Auto backup is disabled, skipping")
            return

        # 使用配置的默认备份方式（full/quick）
        backup_mode = config.default_backup_mode or "full"

        # 获取锁：避免与手动导出/恢复并发冲突
        if not acquire_backup_lock():
            logger.info("Scheduled backup skipped: another backup/restore in progress")
            return

        # 执行备份
        backup_service = WebDAVBackup(config)
        try:
            result = backup_service.create_backup(backup_type="auto", backup_mode=backup_mode)
            logger.info(f"Scheduled backup completed: {result}")
        finally:
            release_backup_lock()

    except Exception as e:
        logger.error(f"Scheduled backup failed: {e}")


def update_scheduled_jobs():
    """更新定时任务"""
    try:
        config = get_config()
        if not config:
            logger.warning("No WebDAV config found, removing all scheduled jobs")
            scheduler.remove_all_jobs()
            return

        # 移除现有的备份任务
        jobs = scheduler.get_jobs()
        for job in jobs:
            if job.id == "auto_backup":
                scheduler.remove_job(job.id)

        # 如果启用了自动备份，添加新任务
        if config.auto_backup_enabled == 1:
            schedule = config.auto_backup_schedule or "0 2 * * *"
            # 解析 Cron 表达式并创建触发器
            parts = schedule.split()
            if len(parts) == 5:
                minute, hour, day, month, day_of_week = parts
                scheduler.add_job(
                    backup_job,
                    trigger=CronTrigger(
                        minute=minute,
                        hour=hour,
                        day=day,
                        month=month,
                        day_of_week=day_of_week
                    ),
                    id="auto_backup",
                    name="自动备份",
                    replace_existing=True
                )
                logger.info(f"Scheduled auto backup with cron: {schedule}")
            else:
                logger.error(f"Invalid cron expression: {schedule}")

    except Exception as e:
        logger.error(f"Failed to update scheduled jobs: {e}")


def start_scheduler():
    """启动调度器"""
    try:
        if not scheduler.running:
            scheduler.start()
            logger.info("Scheduler started")

            # 初始化定时任务
            update_scheduled_jobs()

            # 添加缓存清理定时任务
            _setup_cache_cleaner_job()

            # 添加 _pending 残留定时清理（每 30 分钟）
            _setup_pending_cleanup_job()

            # 添加任务心跳看门狗（检测并清理卡死的后台任务）
            _setup_task_watchdog_job()

            # 接入订阅调度管理器（替代旧的全局订阅轮询）
            from app.tasks.subscription_scheduler import init_subscription_scheduler
            init_subscription_scheduler(scheduler)
        else:
            logger.warning("Scheduler already running")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def _setup_cache_cleaner_job():
    """设置缓存清理定时任务"""
    try:
        # 解析 Cron 表达式
        parts = CACHE_CLEAN_SCHEDULE.split()
        if len(parts) == 5:
            minute, hour, day, month, day_of_week = parts
            scheduler.add_job(
                cache_cleaner_job,
                trigger=CronTrigger(
                    minute=minute,
                    hour=hour,
                    day=day,
                    month=month,
                    day_of_week=day_of_week
                ),
                id="cache_cleaner",
                name="缓存清理",
                replace_existing=True
            )
            logger.info(f"已添加缓存清理定时任务 (TTL={CACHE_TTL_DAYS}天, Schedule={CACHE_CLEAN_SCHEDULE})")
        else:
            logger.error(f"无效的缓存清理 Cron 表达式: {CACHE_CLEAN_SCHEDULE}")
    except Exception as e:
        logger.error(f"设置缓存清理任务失败: {e}")


def _setup_pending_cleanup_job():
    """设置 _pending 残留目录定时清理"""
    try:
        from apscheduler.triggers.interval import IntervalTrigger
        scheduler.add_job(
            cleanup_stale_pending,
            trigger=IntervalTrigger(minutes=30),
            id="pending_cleanup",
            name="_pending 残留清理",
            replace_existing=True,
        )
        logger.info("已添加 _pending 残留定时清理任务 (间隔=30分钟)")
    except Exception as e:
        logger.error(f"设置 _pending 清理任务失败: {e}")


def _task_watchdog_job():
    """任务心跳看门狗：检测卡死的后台任务并自动释放槽位。

    逻辑：
    1. 从 task_queue 获取心跳超时的运行中任务
    2. 对每个超时任务：写 FAILED 状态 -> 清理 _pending -> release 槽位
    3. release 返回的 next_task_id 由已注册的 _start_callback 拉起
    """
    try:
        from app.services.task_queue import task_queue
        from app.services.note import TaskStatus, NoteGenerator
        from app.routers.note import _cleanup_pending, _start_queued_task

        stale_tasks = task_queue.get_stale_tasks(WATCHDOG_TASK_TIMEOUT_SECONDS)
        if not stale_tasks:
            return

        logger.warning(f"看门狗发现 {len(stale_tasks)} 个卡死任务: {stale_tasks}")

        for task_id in stale_tasks:
            try:
                # 写 FAILED 状态到 status.json（让前端看到超时信息）
                NoteGenerator()._update_status(
                    task_id, TaskStatus.FAILED,
                    message=f"任务执行超时（{WATCHDOG_TASK_TIMEOUT_SECONDS}秒无心跳），已被系统终止"
                )
                # 清理 _pending 临时文件
                _cleanup_pending(task_id, keep_status=True)
                # 释放槽位（幂等：如果任务恰好在此期间结束，release 会安全返回 None）
                next_task_id = task_queue.release(task_id)
                if next_task_id:
                    _start_queued_task(next_task_id)
                logger.info(f"看门狗已清理卡死任务 {task_id}")
            except Exception as e:
                logger.error(f"看门狗清理任务 {task_id} 失败: {e}", exc_info=True)

    except Exception as e:
        logger.error(f"看门狗执行失败: {e}", exc_info=True)


def _setup_task_watchdog_job():
    """设置任务心跳看门狗定时任务"""
    try:
        scheduler.add_job(
            _task_watchdog_job,
            trigger=IntervalTrigger(minutes=WATCHDOG_INTERVAL_MINUTES),
            id="task_watchdog",
            name="任务心跳看门狗",
            replace_existing=True,
        )
        logger.info(
            f"已添加任务心跳看门狗 (间隔={WATCHDOG_INTERVAL_MINUTES}分钟, "
            f"超时阈值={WATCHDOG_TASK_TIMEOUT_SECONDS}秒)"
        )
    except Exception as e:
        logger.error(f"设置任务看门狗失败: {e}")


def shutdown_scheduler():
    """关闭调度器"""
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("Scheduler shutdown")
    except Exception as e:
        logger.error(f"Failed to shutdown scheduler: {e}")
