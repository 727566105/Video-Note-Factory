from datetime import datetime
from sqlalchemy import desc
from app.db.engine import get_db
from app.utils.logger import get_logger
from app.db.models.obsidian_export_history import ObsidianExportHistory

logger = get_logger(__name__)


def add_export_record(
    task_id: str,
    export_mode: str = None,
    file_path: str = None,
    status: str = "success",
    error_message: str = None
):
    """添加导出记录"""
    db = next(get_db())
    try:
        history = ObsidianExportHistory(
            task_id=task_id,
            export_mode=export_mode,
            file_path=file_path,
            status=status,
            error_message=error_message
        )
        db.add(history)
        db.commit()
        logger.info(f"Export record added: task_id={task_id}, status={status}")
        return history.id
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add export record: {e}")
        raise
    finally:
        db.close()


def get_export_history(limit: int = 50):
    """获取导出历史"""
    db = next(get_db())
    try:
        histories = db.query(ObsidianExportHistory)\
            .order_by(desc(ObsidianExportHistory.created_at))\
            .limit(limit)\
            .all()
        return histories
    except Exception as e:
        logger.error(f"Failed to get export history: {e}")
        return []
    finally:
        db.close()


def get_task_export_history(task_id: str):
    """获取指定任务的导出历史"""
    db = next(get_db())
    try:
        histories = db.query(ObsidianExportHistory)\
            .filter_by(task_id=task_id)\
            .order_by(desc(ObsidianExportHistory.created_at))\
            .all()
        return histories
    except Exception as e:
        logger.error(f"Failed to get task export history: {e}")
        return []
    finally:
        db.close()
