from typing import Optional
from app.db.models.video_tasks import VideoTask
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


# 插入任务（已存在则跳过）
def insert_video_task(video_id: str, platform: str, task_id: str, video_url: str = None,
                      user_id: int = 1, author_id: str = None, author_name: str = None):
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
            user_id=user_id,
            author_id=author_id,
            author_name=author_name
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
def get_task_by_video(video_id: str, platform: str, user_id: int = None):
    db = next(get_db())
    try:
        query = db.query(VideoTask).filter_by(video_id=video_id, platform=platform)
        if user_id:
            query = query.filter_by(user_id=user_id)
        task = query.order_by(VideoTask.created_at.desc()).first()
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
                         duration: float = None, author: str = None, description: str = None,
                         author_id: str = None, author_name: str = None):
    """更新任务的元数据（标题、封面、时长、作者、描述）"""
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
            if description is not None:
                task.description = description
            if author_id is not None:
                task.author_id = author_id
            if author_name is not None:
                task.author_name = author_name
            db.commit()
            logger.info(f"Task metadata updated: {task_id}, title={title}")
        else:
            logger.warning(f"No task found for metadata update: {task_id}")
    except Exception as e:
        logger.error(f"Failed to update task metadata: {e}")
        db.rollback()
    finally:
        db.close()


def get_task_by_task_id(task_id: str) -> Optional[VideoTask]:
    """根据 task_id 查询任务"""
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id).first()
        return task
    except Exception as e:
        logger.error(f"Failed to get task by task_id: {e}")
        return None
    finally:
        db.close()


def find_completed_task_by_video(video_id: str, platform: str) -> Optional[VideoTask]:
    """跨用户查找已完成笔记的任务（用于复用）"""
    from app.utils.path_helper import get_note_file_path
    db = next(get_db())
    try:
        tasks = db.query(VideoTask).filter_by(
            video_id=video_id, platform=platform
        ).order_by(VideoTask.created_at.desc()).all()
        for task in tasks:
            # 使用 path_helper 检查笔记文件是否存在
            note_path = get_note_file_path(task.task_id, task.title if hasattr(task, 'title') else None, "note")
            if note_path.exists():
                logger.info(f"找到可复用笔记: video_id={video_id}, task_id={task.task_id}")
                return task
        return None
    except Exception as e:
        logger.error(f"查找可复用笔记失败: {e}")
        return None
    finally:
        db.close()


def clone_task_to_user(original_task_id: str, new_user_id: int,
                       video_id: str, platform: str, video_url: str = None) -> VideoTask:
    """为新用户创建指向同一笔记的任务记录（用于复用）"""
    db = next(get_db())
    try:
        # 避免同一用户重复创建
        existing = db.query(VideoTask).filter_by(
            task_id=original_task_id, user_id=new_user_id
        ).first()
        if existing:
            return existing

        # 从原始任务复制元数据
        original = db.query(VideoTask).filter_by(task_id=original_task_id).first()
        task = VideoTask(
            video_id=video_id,
            platform=platform,
            task_id=original_task_id,
            video_url=video_url,
            user_id=new_user_id,
            title=original.title if original else None,
            cover_url=original.cover_url if original else None,
            duration=original.duration if original else None,
            author=original.author if original else None,
            description=original.description if original else None,
            author_id=original.author_id if original else None,
            author_name=original.author_name if original else None,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        logger.info(f"已为用户 {new_user_id} 复用笔记 task_id={original_task_id}")
        return task
    except Exception as e:
        db.rollback()
        logger.error(f"复用笔记失败: {e}")
        raise
    finally:
        db.close()