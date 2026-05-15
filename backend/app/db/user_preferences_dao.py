from app.db.models.user_preferences import UserPreference
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


def get_preferences(user_id: int) -> dict:
    db = next(get_db())
    try:
        record = db.query(UserPreference).filter_by(user_id=user_id).first()
        if record and record.preferences:
            return record.preferences
        return {}
    except Exception as e:
        logger.error(f"获取用户偏好失败: {e}")
        return {}
    finally:
        db.close()


def save_preferences(user_id: int, preferences: dict) -> dict:
    db = next(get_db())
    try:
        record = db.query(UserPreference).filter_by(user_id=user_id).first()
        if record:
            record.preferences = preferences
        else:
            record = UserPreference(user_id=user_id, preferences=preferences)
            db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(f"用户偏好已保存: user_id={user_id}")
        return record.preferences
    except Exception as e:
        db.rollback()
        logger.error(f"保存用户偏好失败: {e}")
        raise
    finally:
        db.close()
