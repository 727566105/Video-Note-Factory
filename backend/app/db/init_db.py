from app.db.models.models import Model
from app.db.models.providers import Provider
from app.db.models.video_tasks import VideoTask
from app.db.models.siyuan_config import SiyuanConfig
from app.db.models.siyuan_export_history import SiyuanExportHistory
from app.db.models.webdav_config import WebDAVConfig
from app.db.models.backup_history import BackupHistory
from app.db.models.users import User
from app.db.models.user_preferences import UserPreference
from app.db.models.subscriptions import Subscription, FeedItem
from app.db.models.model_usage_history import ModelUsageHistory
from app.db.engine import get_engine, Base, get_db
from app.utils.logger import get_logger
from sqlalchemy import text
import json
import os

logger = get_logger(__name__)

def migrate_video_tasks_table():
    """检查并添加 video_tasks 表缺失的列"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(video_tasks)"))
        columns = [row[1] for row in result.fetchall()]

        if 'video_url' not in columns:
            logger.info("video_url 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN video_url VARCHAR"))
            db.commit()
            logger.info("video_url 列添加成功")
        else:
            logger.info("video_url 列已存在")

        if 'user_id' not in columns:
            logger.info("user_id 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN user_id INTEGER DEFAULT 1"))
            db.commit()
            logger.info("user_id 列添加成功")
        else:
            logger.info("user_id 列已存在")

        if 'title' not in columns:
            logger.info("title 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN title VARCHAR"))
            db.commit()
            logger.info("title 列添加成功")

        if 'cover_url' not in columns:
            logger.info("cover_url 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN cover_url VARCHAR"))
            db.commit()
            logger.info("cover_url 列添加成功")

        if 'duration' not in columns:
            logger.info("duration 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN duration FLOAT"))
            db.commit()
            logger.info("duration 列添加成功")

        if 'author' not in columns:
            logger.info("author 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN author VARCHAR"))
            db.commit()
            logger.info("author 列添加成功")
    except Exception as e:
        logger.error(f"数据库迁移失败: {e}")
    finally:
        db.close()


def backfill_task_metadata():
    """从 JSON 文件回填已有任务的元数据到数据库"""
    from app.utils.path_helper import get_note_file_path
    
    db = next(get_db())
    backfilled = 0
    try:
        tasks = db.query(VideoTask).all()
        for task in tasks:
            # 如果已有 title，跳过
            if task.title:
                continue
            result_path = get_note_file_path(task.task_id, None, "note")
            if result_path.exists():
                try:
                    with open(result_path, "r", encoding="utf-8") as f:
                        note_data = json.load(f)
                    audio_meta = note_data.get("audio_meta", {})
                    if audio_meta:
                        task.title = audio_meta.get("title")
                        task.cover_url = audio_meta.get("cover_url")
                        task.duration = audio_meta.get("duration")
                        # 从 raw_info 提取作者
                        raw_info = audio_meta.get("raw_info", {})
                        owner = raw_info.get("owner", {})
                        task.author = owner.get("name", "")
                        backfilled += 1
                except Exception as e:
                    logger.warning(f"回填任务 {task.task_id} 元数据失败: {e}")
        db.commit()
        if backfilled > 0:
            logger.info(f"已回填 {backfilled} 条任务元数据")
    except Exception as e:
        logger.error(f"元数据回填失败: {e}")
        db.rollback()
    finally:
        db.close()

def init_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # 执行数据库迁移检查
    migrate_video_tasks_table()
    # 从 JSON 文件回填元数据
    backfill_task_metadata()
    # 种子默认管理员用户
    from app.db.user_dao import seed_default_user
    seed_default_user()
