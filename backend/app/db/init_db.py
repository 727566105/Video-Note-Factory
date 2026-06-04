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
from app.db.models.channel_video import ChannelVideo, ChannelFetchStatus
from app.db.models.channel_video_seen import ChannelVideoSeen
from app.db.models.collection import Collection, CollectionItem, CollectionSummary
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

        if 'description' not in columns:
            logger.info("description 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN description VARCHAR"))
            db.commit()
            logger.info("description 列添加成功")

        if 'author_id' not in columns:
            logger.info("author_id 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN author_id VARCHAR"))
            db.commit()
            logger.info("author_id 列添加成功")

        if 'author_name' not in columns:
            logger.info("author_name 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN author_name VARCHAR"))
            db.commit()
            logger.info("author_name 列添加成功")
    except Exception as e:
        logger.error(f"数据库迁移失败: {e}")
    finally:
        db.close()


def migrate_feed_items_table():
    """检查并添加 feed_items 表缺失的列"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(feed_items)"))
        columns = [row[1] for row in result.fetchall()]

        if 'description' not in columns:
            logger.info("feed_items: description 列不存在，正在添加...")
            db.execute(text("ALTER TABLE feed_items ADD COLUMN description VARCHAR"))
            db.commit()
            logger.info("feed_items: description 列添加成功")

        # 添加 channel_video_id 列（关联频道视频共享表）
        if 'channel_video_id' not in columns:
            logger.info("feed_items: channel_video_id 列不存在，正在添加...")
            db.execute(text(
                "ALTER TABLE feed_items ADD COLUMN channel_video_id INTEGER"
            ))
            db.commit()
            logger.info("feed_items: channel_video_id 列添加成功")
    except Exception as e:
        logger.error(f"feed_items 迁移失败: {e}")
    finally:
        db.close()


def backfill_task_metadata():
    """从 JSON 文件回填已有任务的元数据到数据库"""
    from app.utils.path_helper import find_note_file

    db = next(get_db())
    backfilled = 0
    try:
        tasks = db.query(VideoTask).all()
        for task in tasks:
            # 如果已有 title，跳过
            if task.title:
                continue
            result_path = find_note_file(task.task_id, task.author_id, task.author_name,
                                          task.video_id, None, "note", task.platform)
            if result_path and result_path.exists():
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
                        task.description = audio_meta.get("description")
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

def migrate_channel_fetch_status_cursor():
    """迁移：channel_fetch_status 添加 next_cursor 字段（抖音游标分页）"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(channel_fetch_status)"))
        columns = [row[1] for row in result.fetchall()]
        if "next_cursor" not in columns:
            logger.info("channel_fetch_status: next_cursor 列不存在，正在添加...")
            db.execute(text("ALTER TABLE channel_fetch_status ADD COLUMN next_cursor VARCHAR DEFAULT '0'"))
            db.commit()
            logger.info("channel_fetch_status: next_cursor 列添加成功")
    except Exception as e:
        logger.error(f"channel_fetch_status 迁移失败: {e}")
    finally:
        db.close()


def migrate_video_tasks_tags_column():
    """检查并添加 tags 列到 video_tasks 表"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(video_tasks)"))
        columns = [row[1] for row in result.fetchall()]
        if 'tags' not in columns:
            logger.info("video_tasks: tags 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN tags TEXT"))
            db.commit()
            logger.info("video_tasks: tags 列添加成功")
        else:
            logger.info("video_tasks: tags 列已存在")
    except Exception as e:
        logger.error(f"video_tasks tags 迁移失败: {e}")
    finally:
        db.close()


def migrate_video_tasks_multiuser_columns():
    """检查并添加多用户隔离相关字段"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(video_tasks)"))
        columns = [row[1] for row in result.fetchall()]

        if 'deleted_at' not in columns:
            logger.info("video_tasks: deleted_at 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN deleted_at DATETIME"))
            db.commit()
            logger.info("video_tasks: deleted_at 列添加成功")

        if 'source_task_id' not in columns:
            logger.info("video_tasks: source_task_id 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN source_task_id VARCHAR"))
            db.commit()
            logger.info("video_tasks: source_task_id 列添加成功")

        if 'note_style' not in columns:
            logger.info("video_tasks: note_style 列不存在，正在添加...")
            db.execute(text("ALTER TABLE video_tasks ADD COLUMN note_style VARCHAR"))
            db.commit()
            logger.info("video_tasks: note_style 列添加成功")
    except Exception as e:
        logger.error(f"video_tasks 多用户字段迁移失败: {e}")
    finally:
        db.close()


def init_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # 执行数据库迁移检查
    migrate_video_tasks_table()
    migrate_feed_items_table()
    migrate_channel_fetch_status_cursor()
    migrate_subscriptions_unique_id()
    migrate_video_tasks_tags_column()
    migrate_subscriptions_fetch_time()
    migrate_video_tasks_multiuser_columns()
    # 从 JSON 文件回填元数据
    backfill_task_metadata()
    # 种子默认管理员用户
    from app.db.user_dao import seed_default_user
    seed_default_user()


def migrate_subscriptions_unique_id():
    """迁移：subscriptions 添加 unique_id 字段（抖音号）"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(subscriptions)"))
        columns = [row[1] for row in result.fetchall()]
        if "unique_id" not in columns:
            logger.info("subscriptions: unique_id 列不存在，正在添加...")
            db.execute(text("ALTER TABLE subscriptions ADD COLUMN unique_id VARCHAR"))
            db.commit()
            logger.info("subscriptions: unique_id 列添加成功")
    except Exception as e:
        logger.error(f"subscriptions 迁移失败: {e}")
    finally:
        db.close()


def migrate_subscriptions_fetch_time():
    """迁移：subscriptions 添加 fetch_at_hour 和 fetch_at_day 字段"""
    db = next(get_db())
    try:
        result = db.execute(text("PRAGMA table_info(subscriptions)"))
        columns = [row[1] for row in result.fetchall()]
        if "fetch_at_hour" not in columns:
            logger.info("subscriptions: fetch_at_hour 列不存在，正在添加...")
            db.execute(text("ALTER TABLE subscriptions ADD COLUMN fetch_at_hour INTEGER DEFAULT 3"))
            db.commit()
            logger.info("subscriptions: fetch_at_hour 列添加成功")
        if "fetch_at_day" not in columns:
            logger.info("subscriptions: fetch_at_day 列不存在，正在添加...")
            db.execute(text("ALTER TABLE subscriptions ADD COLUMN fetch_at_day INTEGER"))
            db.commit()
            logger.info("subscriptions: fetch_at_day 列添加成功")
    except Exception as e:
        logger.error(f"subscriptions fetch_time 迁移失败: {e}")
    finally:
        db.close()
