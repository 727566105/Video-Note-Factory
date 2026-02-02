from datetime import datetime
from sqlalchemy import desc
from app.db.engine import get_db
from app.utils.logger import get_logger
from app.db.models.siyuan_export_history import SiyuanExportHistory

logger = get_logger(__name__)


def add_export_record(
    task_id: str,
    siyuan_doc_id: str = None,
    notebook_id: str = None,
    notebook_name: str = None,
    doc_path: str = None,
    status: str = "success",
    error_message: str = None
):
    """添加导出记录"""
    db = next(get_db())
    try:
        history = SiyuanExportHistory(
            task_id=task_id,
            siyuan_doc_id=siyuan_doc_id,
            notebook_id=notebook_id,
            notebook_name=notebook_name,
            doc_path=doc_path,
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
        histories = db.query(SiyuanExportHistory)\
            .order_by(desc(SiyuanExportHistory.created_at))\
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
        histories = db.query(SiyuanExportHistory)\
            .filter_by(task_id=task_id)\
            .order_by(desc(SiyuanExportHistory.created_at))\
            .all()
        return histories
    except Exception as e:
        logger.error(f"Failed to get task export history: {e}")
        return []
    finally:
        db.close()
