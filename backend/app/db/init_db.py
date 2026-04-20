from app.db.models.models import Model
from app.db.models.providers import Provider
from app.db.models.video_tasks import VideoTask
from app.db.models.siyuan_config import SiyuanConfig
from app.db.models.siyuan_export_history import SiyuanExportHistory
from app.db.models.webdav_config import WebDAVConfig
from app.db.models.backup_history import BackupHistory
from app.db.engine import get_engine, Base, get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)

def migrate_video_tasks_table():
    """检查并添加 video_tasks 表缺失的列"""
    db = next(get_db())
    try:
        result = db.execute("PRAGMA table_info(video_tasks)")
        columns = [row[1] for row in result.fetchall()]

        if 'video_url' not in columns:
            logger.info("video_url 列不存在，正在添加...")
            db.execute("ALTER TABLE video_tasks ADD COLUMN video_url VARCHAR")
            db.commit()
            logger.info("video_url 列添加成功")
        else:
            logger.info("video_url 列已存在")
    except Exception as e:
        logger.error(f"数据库迁移失败: {e}")
    finally:
        db.close()

def init_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # 执行数据库迁移检查
    migrate_video_tasks_table()
