"""博主信息 API"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from app.auth.dependencies import get_current_user
from app.db.engine import get_db
from app.db.models.video_tasks import VideoTask
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/authors", tags=["博主信息"])


@router.get("")
def get_authors(current_user=Depends(get_current_user)) -> dict:
    """获取博主列表（去重，含视频数统计）"""
    db = next(get_db())
    try:
        results = (
            db.query(
                VideoTask.author_id,
                VideoTask.author_name,
                func.count(VideoTask.id).label("video_count"),
            )
            .filter(
                VideoTask.author_id.isnot(None),
                VideoTask.author_id != "",
                VideoTask.user_id == current_user.id,
            )
            .group_by(VideoTask.author_id, VideoTask.author_name)
            .order_by(func.count(VideoTask.id).desc())
            .all()
        )

        authors = []
        for r in results:
            authors.append({
                "author_id": r.author_id,
                "author_name": r.author_name or r.author_id,
                "video_count": r.video_count,
            })

        return R.success({"authors": authors})
    finally:
        db.close()


@router.get("/{author_id}/videos")
def get_author_videos(author_id: str, limit: int = 50, offset: int = 0,
                      current_user=Depends(get_current_user)) -> dict:
    """获取博主下的视频列表"""
    import json
    from app.utils.path_helper import find_note_file

    db = next(get_db())
    try:
        query = db.query(VideoTask).filter(
            VideoTask.author_id == author_id,
            VideoTask.user_id == current_user.id,
        ).order_by(VideoTask.created_at.desc())

        total = query.count()
        tasks = query.offset(offset).limit(limit).all()

        videos = []
        for task in tasks:
            status = "PENDING"
            status_path = find_note_file(task.task_id, task.author_id, task.author_name,
                                         task.video_id, task.title, "status", task.platform)
            result_path = find_note_file(task.task_id, task.author_id, task.author_name,
                                         task.video_id, task.title, "note", task.platform)

            if status_path and status_path.exists():
                try:
                    with open(status_path, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                        status = status_data.get("status", "PENDING")
                except Exception:
                    pass
            elif result_path and result_path.exists():
                status = "SUCCESS"

            videos.append({
                "task_id": task.task_id,
                "video_id": task.video_id,
                "platform": task.platform,
                "title": task.title,
                "cover_url": task.cover_url,
                "duration": task.duration,
                "status": status,
                "created_at": task.created_at.isoformat() if task.created_at else None,
            })

        return R.success({"videos": videos, "total": total})
    finally:
        db.close()