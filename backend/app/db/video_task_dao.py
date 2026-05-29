from typing import Optional
from app.db.models.video_tasks import VideoTask
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


# 插入任务（已存在则跳过）
def insert_video_task(video_id: str, platform: str, task_id: str, video_url: str = None,
                      user_id: int = 1, author_id: str = None, author_name: str = None,
                      note_style: str = None):
    db = next(get_db())
    try:
        existing = db.query(VideoTask).filter_by(task_id=task_id, user_id=user_id).first()
        if existing:
            return
        task = VideoTask(
            video_id=video_id,
            platform=platform,
            task_id=task_id,
            video_url=video_url,
            user_id=user_id,
            author_id=author_id,
            author_name=author_name,
            note_style=note_style,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        logger.info(f"Video task inserted successfully. video_id: {video_id}, platform: {platform}, task_id: {task_id}, video_url: {video_url}")
    except Exception as e:
        logger.error(f"Failed to insert video task: {e}")
        raise
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


# 获取所有任务（所有用户只看自己的笔记，过滤已软删除的）
def get_all_tasks(user_id: int = None, role: str = "user", limit: int = None):
    db = next(get_db())
    try:
        query = db.query(VideoTask).filter(
            VideoTask.deleted_at.is_(None)
        ).order_by(VideoTask.created_at.desc())
        # 所有用户都只看自己的任务
        if user_id:
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
                         author_id: str = None, author_name: str = None, tags: str = None,
                         video_id: str = None):
    """更新任务的元数据（标题、封面、时长、作者、描述、标签）"""
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
            if tags is not None:
                task.tags = tags
            if video_id is not None:
                task.video_id = video_id
            db.commit()
            logger.info(f"Task metadata updated: {task_id}, title={title}, tags={tags}")
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


def get_task_by_task_id_and_user(task_id: str, user_id: int) -> Optional[VideoTask]:
    """根据 task_id 和 user_id 查询任务（权限安全）"""
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id, user_id=user_id).first()
        return task
    except Exception as e:
        logger.error(f"Failed to get task by task_id_and_user: {e}")
        return None
    finally:
        db.close()


def find_completed_task_by_video(video_id: str, platform: str) -> Optional[VideoTask]:
    """跨用户查找已完成笔记的任务（用于复用）"""
    from app.utils.path_helper import find_note_file
    db = next(get_db())
    try:
        tasks = db.query(VideoTask).filter_by(
            video_id=video_id, platform=platform
        ).order_by(VideoTask.created_at.desc()).all()
        for task in tasks:
            # 使用 find_note_file 查找笔记文件（不创建目录），支持多用户查找
            note_path = find_note_file(task.task_id, task.author_id, task.author_name,
                                        task.video_id, task.title, "note", platform,
                                        user_id=None)  # 复用查找时不限制用户
            if note_path and note_path.exists():
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

        # 从原始任务复制元数据（包括标签）
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
            tags=original.tags if original else None,
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


def batch_update_cover_url(video_id: str, platform: str, new_cover_url: str):
    """批量更新指定视频的 cover_url"""
    db = next(get_db())
    try:
        tasks = db.query(VideoTask).filter(
            VideoTask.video_id == video_id,
            VideoTask.platform == platform
        ).all()
        for task in tasks:
            task.cover_url = new_cover_url
        db.commit()
        return len(tasks)
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def find_source_data(video_id: str, platform: str) -> Optional[VideoTask]:
    """查找指定视频是否已有源数据（transcript.json），用于半流程复用"""
    from app.utils.path_helper import find_note_file
    db = next(get_db())
    try:
        tasks = db.query(VideoTask).filter_by(
            video_id=video_id, platform=platform
        ).order_by(VideoTask.created_at.desc()).all()
        for task in tasks:
            transcript_path = find_note_file(
                task.task_id, task.author_id, task.author_name,
                task.video_id, task.title, "transcript", platform
            )
            if transcript_path and transcript_path.exists():
                logger.info(f"找到可复用源数据: video_id={video_id}, task_id={task.task_id}")
                return task
        return None
    except Exception as e:
        logger.error(f"查找可复用源数据失败: {e}")
        return None
    finally:
        db.close()


def find_matching_note(video_id: str, platform: str, user_id: int,
                       note_style: str = None) -> Optional[VideoTask]:
    """查找同视频同风格的已有笔记（跨用户），用于智能复用

    :param note_style: 笔记风格（minimal/academic等），None 表示匹配任意风格
    :return: 找到的任务记录（带 note 文件）
    """
    from app.utils.path_helper import find_note_file
    db = next(get_db())
    try:
        query = db.query(VideoTask).filter_by(
            video_id=video_id, platform=platform
        ).order_by(VideoTask.created_at.desc())
        tasks = query.all()
        for task in tasks:
            if task.user_id == user_id:
                continue  # 跳过自己的任务
            if note_style and task.note_style and task.note_style != note_style:
                continue  # 风格不匹配
            note_path = find_note_file(
                task.task_id, task.author_id, task.author_name,
                task.video_id, task.title, "note", platform,
                user_id=task.user_id
            )
            if note_path and note_path.exists():
                logger.info(f"找到可复用笔记: video_id={video_id}, style={note_style}, "
                            f"from_user={task.user_id}, task_id={task.task_id}")
                return task
        return None
    except Exception as e:
        logger.error(f"查找可复用笔记失败: {e}")
        return None
    finally:
        db.close()


def soft_delete_task(task_id: str, user_id: int):
    """软删除任务（标记 deleted_at，前端隐藏，数据保留）"""
    from datetime import datetime
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id, user_id=user_id).first()
        if task:
            task.deleted_at = datetime.now()
            db.commit()
            logger.info(f"任务已软删除: task_id={task_id}, user_id={user_id}")
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"软删除任务失败: {e}")
        return False
    finally:
        db.close()


def get_user_task_for_video(video_id: str, platform: str, user_id: int) -> Optional[VideoTask]:
    """查找当前用户对指定视频的任务记录（未删除）"""
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(
            video_id=video_id, platform=platform, user_id=user_id
        ).filter(VideoTask.deleted_at.is_(None)).order_by(
            VideoTask.created_at.desc()
        ).first()
        return task
    except Exception as e:
        logger.error(f"查找用户任务失败: {e}")
        return None
    finally:
        db.close()


def get_deleted_tasks(older_than_days: int = 30) -> list:
    """获取已软删除超过指定天数的任务（管理员清理用）"""
    from datetime import datetime, timedelta
    db = next(get_db())
    try:
        cutoff = datetime.now() - timedelta(days=older_than_days)
        tasks = db.query(VideoTask).filter(
            VideoTask.deleted_at.isnot(None),
            VideoTask.deleted_at < cutoff
        ).all()
        return tasks
    except Exception as e:
        logger.error(f"查询已删除任务失败: {e}")
        return []
    finally:
        db.close()


def hard_delete_task(task_id: str) -> bool:
    """真正删除任务记录（管理员清理）"""
    db = next(get_db())
    try:
        task = db.query(VideoTask).filter_by(task_id=task_id).first()
        if task:
            db.delete(task)
            db.commit()
            logger.info(f"任务已硬删除: task_id={task_id}")
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"硬删除任务失败: {e}")
        return False
    finally:
        db.close()