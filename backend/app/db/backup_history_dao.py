from datetime import datetime
from sqlalchemy.orm import Session
from app.db.models.backup_history import BackupHistory
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


def add_backup_record(type: str, status: str, file_size: int = 0,
                      file_count: int = 0, error_message: str = None) -> int:
    """添加备份历史记录"""
    db = next(get_db())
    try:
        history = BackupHistory(
            type=type,
            status=status,
            file_size=file_size,
            file_count=file_count,
            error_message=error_message
        )
        db.add(history)
        db.commit()
        logger.info(f"Added backup history: {history.id}, type={type}, status={status}")
        return history.id
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add backup history: {e}")
        raise
    finally:
        db.close()


def get_backup_history(limit: int = 50):
    """获取备份历史列表"""
    db = next(get_db())
    try:
        histories = db.query(BackupHistory).order_by(
            BackupHistory.created_at.desc()
        ).limit(limit).all()
        return histories
    except Exception as e:
        logger.error(f"Failed to get backup history: {e}")
        raise
    finally:
        db.close()


def get_latest_backup():
    """获取最新的备份记录"""
    db = next(get_db())
    try:
        history = db.query(BackupHistory).filter(
            BackupHistory.status == 'success'
        ).order_by(
            BackupHistory.created_at.desc()
        ).first()
        return history
    except Exception as e:
        logger.error(f"Failed to get latest backup: {e}")
        raise
    finally:
        db.close()


def get_backup_stats():
    """获取备份统计信息"""
    db = next(get_db())
    try:
        total = db.query(BackupHistory).count()
        successful = db.query(BackupHistory).filter(
            BackupHistory.status == 'success'
        ).count()
        failed = db.query(BackupHistory).filter(
            BackupHistory.status == 'failed'
        ).count()
        return {
            'total': total,
            'successful': successful,
            'failed': failed
        }
    except Exception as e:
        logger.error(f"Failed to get backup stats: {e}")
        raise
    finally:
        db.close()


def delete_backup_record(history_id: int) -> bool:
    """删除单条备份历史记录"""
    db = next(get_db())
    try:
        record = db.query(BackupHistory).filter(BackupHistory.id == history_id).first()
        if record:
            db.delete(record)
            db.commit()
            logger.info(f"Deleted backup history: {history_id}")
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete backup history: {e}")
        raise
    finally:
        db.close()


def delete_all_backup_records() -> int:
    """删除所有备份历史记录，返回删除数量"""
    db = next(get_db())
    try:
        count = db.query(BackupHistory).count()
        db.query(BackupHistory).delete()
        db.commit()
        logger.info(f"Deleted all backup history: {count} records")
        return count
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete all backup history: {e}")
        raise
    finally:
        db.close()
