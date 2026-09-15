"""video_task_dao 幽灵任务回归测试

背景：旧库软删时代在 video_tasks 表留下 deleted_at 非空的记录，
模型已移除 deleted_at 字段，若查询不过滤会把这些"已删除任务"重新带回列表，
导致前端渲染已删任务、封面 404、轮询幽灵状态。

修复：查询层用 SQL 表达式过滤 deleted_at IS NULL（兼容新库无此列）。
"""
import uuid

import pytest
from sqlalchemy import text

from app.db.engine import get_db
from app.db.video_task_dao import get_all_tasks, get_task_by_video, insert_video_task


def _has_deleted_at_col(db) -> bool:
    rows = db.execute(text("PRAGMA table_info(video_tasks)")).fetchall()
    return any(r[1] == "deleted_at" for r in rows)


def _insert_ghost(db, task_id: str, video_id: str) -> None:
    """直接 SQL 插入一条 deleted_at 非空的软删残留记录"""
    db.execute(
        text(
            "INSERT INTO video_tasks (video_id, platform, task_id, user_id, created_at, deleted_at) "
            "VALUES (:vid, 'local', :tid, 1, datetime('now'), datetime('now'))"
        ),
        {"vid": video_id, "tid": task_id},
    )
    db.commit()


def _cleanup(db, task_id: str) -> None:
    db.execute(text("DELETE FROM video_tasks WHERE task_id = :tid"), {"tid": task_id})
    db.commit()


@pytest.mark.parametrize("user_id", [1])
def test_get_all_tasks_filters_ghost_rows(user_id):
    """get_all_tasks 不得返回 deleted_at 非空的幽灵任务"""
    db = next(get_db())
    if not _has_deleted_at_col(db):
        db.close()
        pytest.skip("当前库无 deleted_at 列（新库无此场景）")

    ghost_tid = f"test-ghost-{uuid.uuid4().hex[:12]}"
    ghost_vid = f"ghost-{uuid.uuid4().hex}"
    try:
        _insert_ghost(db, ghost_tid, ghost_vid)
        db.close()  # 让 get_all_tasks 用独立连接

        tasks = get_all_tasks(user_id=user_id, role="admin", limit=None)
        assert not any(t.task_id == ghost_tid for t in tasks), "幽灵任务不应出现在列表中"
    finally:
        db = next(get_db())
        _cleanup(db, ghost_tid)
        db.close()


def test_get_task_by_video_filters_ghost_rows():
    """get_task_by_video 复用检查不得命中软删残留"""
    db = next(get_db())
    if not _has_deleted_at_col(db):
        db.close()
        pytest.skip("当前库无 deleted_at 列（新库无此场景）")

    ghost_tid = f"test-ghost-{uuid.uuid4().hex[:12]}"
    ghost_vid = f"ghost-{uuid.uuid4().hex}"
    try:
        _insert_ghost(db, ghost_tid, ghost_vid)
        db.close()

        found = get_task_by_video(ghost_vid, "local", user_id=1)
        assert found is None, "复用检查不应命中已删除任务"
    finally:
        db = next(get_db())
        _cleanup(db, ghost_tid)
        db.close()


def test_insert_video_task_ignores_ghost_rows():
    """insert_video_task 的重复检查不应把幽灵任务当已存在任务"""
    db = next(get_db())
    if not _has_deleted_at_col(db):
        db.close()
        pytest.skip("当前库无 deleted_at 列（新库无此场景）")

    ghost_tid = f"test-ghost-{uuid.uuid4().hex[:12]}"
    ghost_vid = f"ghost-{uuid.uuid4().hex}"
    new_tid = f"test-new-{uuid.uuid4().hex[:12]}"
    try:
        _insert_ghost(db, ghost_tid, ghost_vid)
        db.close()

        # 同 video_id/platform 但幽灵行 task_id 不同，应能正常插入新任务
        insert_video_task(video_id=ghost_vid, platform="local", task_id=new_tid, user_id=1)

        db = next(get_db())
        exists = db.execute(
            text("SELECT COUNT(*) FROM video_tasks WHERE task_id = :tid"),
            {"tid": new_tid},
        ).fetchone()[0]
        assert exists == 1, "幽灵行不应阻塞新任务插入"
    finally:
        db = next(get_db())
        _cleanup(db, ghost_tid)
        _cleanup(db, new_tid)
        db.close()
