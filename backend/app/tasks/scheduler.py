"""定时任务调度器"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.webdav_config_dao import get_config
from app.services.webdav_backup import WebDAVBackup
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 全局调度器实例
scheduler = BackgroundScheduler()


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

        # 执行备份
        backup_service = WebDAVBackup(config)
        result = backup_service.create_backup(backup_type="auto")

        logger.info(f"Scheduled backup completed: {result}")

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
        else:
            logger.warning("Scheduler already running")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def shutdown_scheduler():
    """关闭调度器"""
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("Scheduler shutdown")
    except Exception as e:
        logger.error(f"Failed to shutdown scheduler: {e}")
