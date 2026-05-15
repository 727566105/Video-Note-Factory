from app.db.models.video_tasks import VideoTask
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


# 插入任务（已存在则跳过）
def insert_video_task(video_id: str, platform: str, task_id: str, video_url: str = None, user_id: int = 1):
    db = next(get_db())
    try:
        existing = db.query(VideoTask).filter_by(task_id=task_id).first()
        if existing:
            return
        task = VideoTask(
            video_id=video_id,
            platform=platform,
            task_id=task_id,
            video_url=video_url,
            user_id=user_id
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        logger.info(f"Video task inserted successfully. video_id: {video_id}, platform: {platform}, task_id: {task_id}, video_url: {video_url}")
    except Exception as e:
        logger.error(f"Failed to insert video task: {e}")
    finally:
        db.close()


# 查询任务（最新一条）
def get_task_by_video(video_id: str, platform: str):
    db = next(get_db())
    try:
        task = (
            db.query(VideoTask)
            .filter_by(video_id=video_id, platform=platform)
            .order_by(VideoTask.created_at.desc())
            .first()
        )
        if task:
            logger.info(f"Task found for video_id: {video_id} and platform: {platform}")
            return task.task_id
        else:
            logger.info(f"No task found for video_id: {video_id} and platform: {platform}")
            return None
    except Exception as e:
        logger.error(f"Failed to get task by video: {e}")
    finally:
        db.close()


# 删除任务
def delete_task_by_video(video_id: str, platform: str):
    db = next(get_db())
    try:
        tasks = (
            db.query(VideoTask)
            .filter_by(video_id=video_id, platform=platform)
            .all()
        )
        for task in tasks:
            db.delete(task)
        db.commit()
        logger.info(f"Task(s) deleted for video_id: {video_id} and platform: {platform}")
    except Exception as e:
        logger.error(f"Failed to delete task by video: {e}")
    finally:
        db.close()


# 根据 task_id 删除任务
def delete_task_by_id(task_id: str):
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id).first()
        if task:
            db.delete(task)
            db.commit()
            logger.info(f"Task deleted for task_id: {task_id}")
        else:
            logger.warning(f"No task found for task_id: {task_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete task by id: {e}")
        raise
    finally:
        db.close()


# 获取所有任务（按用户隔离，管理员可看全部）
def get_all_tasks(user_id: int = None, role: str = "user", limit: int = None):
    db = next(get_db())
    try:
        query = db.query(VideoTask).order_by(VideoTask.created_at.desc())
        # 非管理员只能看自己的任务
        if role != "admin" and user_id:
            query = query.filter_by(user_id=user_id)
        if limit:
            query = query.limit(limit)
        tasks = query.all()
        logger.info(f"Retrieved {len(tasks)} tasks for user_id={user_id}, role={role}")
        return tasks
    except Exception as e:
        logger.error(f"Failed to get all tasks: {e}")
        return []
    finally:
        db.close()


def update_task_metadata(task_id: str, title: str = None, cover_url: str = None,
                         duration: float = None, author: str = None):
    """更新任务的元数据（标题、封面、时长、作者）"""
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id).first()
        if task:
            if title is not None:
                task.title = title
            if cover_url is not None:
                task.cover_url = cover_url
            if duration is not None:
                task.duration = duration
            if author is not None:
                task.author = author
            db.commit()
            logger.info(f"Task metadata updated: {task_id}, title={title}")
        else:
            logger.warning(f"No task found for metadata update: {task_id}")
    except Exception as e:
        logger.error(f"Failed to update task metadata: {e}")
        db.rollback()
    finally:
        db.close()