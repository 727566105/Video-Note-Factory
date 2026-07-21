"""多用户数据隔离 + 智能复用 API 单元测试

测试场景：
1. 物理删除：用户删除笔记后数据库记录消失，本地文件清理
2. 跨用户访问拒绝：403
3. 任务列表不含已删除任务
4. 笔记文件命名验证
"""
import json
import os
import pytest
from datetime import datetime, timedelta
from pathlib import Path
from fastapi.testclient import TestClient
from fastapi import FastAPI

# 检查数据库和 bcrypt 兼容性
_db_ok = False
try:
    from app.db.init_db import init_db
    init_db()
    from app.db.user_dao import hash_password
    hash_password("test")
    _db_ok = True
except Exception:
    pass


@pytest.fixture
def app():
    from app.routers import auth, note, config
    _app = FastAPI()
    _app.include_router(auth.router, prefix="/api/auth")
    _app.include_router(note.router, prefix="/api")
    _app.include_router(config.router, prefix="/api")
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


def _get_token(client: TestClient, username: str, password: str):
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    data = resp.json()
    if data.get("code") != 0:
        return None
    return data.get("data", {}).get("token")


@pytest.fixture
def admin_token(client):
    return _get_token(client, "admin", "123456")


@pytest.fixture
def user_token(client):
    """获取测试用户 token，如不存在则创建"""
    token = _get_token(client, "testuser", "123456")
    if not token:
        try:
            from app.db.user_dao import create_user
            create_user("testuser", "123456", "user")
        except Exception:
            pass
        token = _get_token(client, "testuser", "123456")
    return token


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestHardDelete:
    """TC05: 物理删除测试"""

    def test_hard_delete_removes_record(self, client, admin_token):
        """删除笔记后，数据库记录被物理删除（get_task_by_task_id 返回 None）"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        # 先获取一个任务
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有可删除的测试数据")
        task_id = tasks[0]["task_id"]

        # 执行删除
        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

        # 验证数据库中记录已被物理删除
        from app.db.video_task_dao import get_task_by_task_id
        task = get_task_by_task_id(task_id)
        assert task is None, "任务记录应已被物理删除"

    def test_deleted_task_not_in_list(self, client, admin_token):
        """已删除的任务不应出现在任务列表中"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        # 列表中所有任务都应能在数据库中查到（物理删除的不在表内）
        from app.db.video_task_dao import get_task_by_task_id
        for task in tasks:
            db_task = get_task_by_task_id(task["task_id"])
            assert db_task is not None, f"任务 {task['task_id']} 在列表中但数据库查不到"

    def test_delete_other_user_task_denied(self, client, admin_token, user_token):
        """用户不能删除其他用户的任务"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        # 获取 admin 的任务
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        # testuser 尝试删除 admin 的任务
        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestCrossUserAccess:
    """TC08: 跨用户访问拒绝"""

    def test_task_status_cross_user_denied(self, client, admin_token, user_token):
        """用户B访问用户A的 task_status 应返回 403"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        resp = client.get(f"/api/task_status/{task_id}",
                          headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    def test_quick_view_cross_user_denied(self, client, admin_token, user_token):
        """用户B快速查看用户A的笔记应返回 403"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        resp = client.get(f"/api/quick_view/{task_id}",
                          headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


class TestNoteFileNaming:
    """TC09: 笔记文件命名验证"""

    def test_note_filename_with_user_id(self):
        """有 user_id 时生成 note_{user_id}.json"""
        from app.utils.path_helper import _note_filename
        assert _note_filename(1) == "note_1.json"
        assert _note_filename(2) == "note_2.json"
        assert _note_filename(999) == "note_999.json"

    def test_note_filename_without_user_id(self):
        """无 user_id 时回退到 note.json"""
        from app.utils.path_helper import _note_filename
        assert _note_filename(None) == "note.json"

    def test_get_video_file_path_note_with_user(self):
        """get_video_file_path 在 file_type='note' 时使用 user_id"""
        from app.utils.path_helper import get_video_file_path
        import tempfile
        # 使用临时目录避免实际创建
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "note", "bilibili", user_id=1)
        assert path.name == "note_1.json"

    def test_get_video_file_path_note_without_user(self):
        """get_video_file_path 在 file_type='note' 无 user_id 时使用 note.json"""
        from app.utils.path_helper import get_video_file_path
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "note", "bilibili")
        assert path.name == "note.json"

    def test_get_video_file_path_audio_unchanged(self):
        """非 note 类型的文件不受 user_id 影响"""
        from app.utils.path_helper import get_video_file_path
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "transcript", "bilibili", user_id=1)
        assert path.name == "transcript.json"


class TestDAOFunctions:
    """DAO 层函数验证"""

    def test_get_all_tasks_no_soft_deleted(self):
        """get_all_tasks 不应返回已物理删除的任务（物理删除后记录不在表内）"""
        from app.db.video_task_dao import get_all_tasks
        if not _db_ok:
            pytest.skip("数据库不可用")
        tasks = get_all_tasks(user_id=1, limit=100)
        # 所有返回的任务都应能在数据库中查到
        from app.db.video_task_dao import get_task_by_task_id
        for task in tasks:
            assert get_task_by_task_id(task.task_id) is not None, f"任务 {task.task_id} 在列表中但数据库查不到"

    def test_find_source_data_function_exists(self):
        """find_source_data 函数应可正常导入"""
        from app.db.video_task_dao import find_source_data
        assert callable(find_source_data)

    def test_find_matching_note_function_exists(self):
        """find_matching_note 函数应可正常导入"""
        from app.db.video_task_dao import find_matching_note
        assert callable(find_matching_note)

    def test_hard_delete_task_by_user_function_exists(self):
        """hard_delete_task_by_user 函数应可正常导入"""
        from app.db.video_task_dao import hard_delete_task_by_user
        assert callable(hard_delete_task_by_user)

    def test_get_user_task_for_video_function_exists(self):
        """get_user_task_for_video 函数应可正常导入"""
        from app.db.video_task_dao import get_user_task_for_video
        assert callable(get_user_task_for_video)


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestGenerateNoteReuse:
    """TC01-TC04: 笔记生成 + 复用逻辑测试"""

    def test_repeat_url_returns_error(self, client, admin_token):
        """TC02: 用户重复提交相同URL应返回错误"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        # 获取已有任务
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有已有任务数据，需要先生成一篇笔记")

        task = tasks[0]
        video_url = task.get("video_url")
        platform = task.get("platform")
        if not video_url or not platform:
            pytest.skip("任务缺少 video_url 或 platform")

        # 重复提交
        resp = client.post("/api/generate_note",
                           json={
                               "video_url": video_url,
                               "platform": platform,
                               "quality": "medium",
                               "model_name": "test",
                               "provider_id": "1",
                           },
                           headers={"Authorization": f"Bearer {admin_token}"})
        data = resp.json()
        # 应返回错误或复用结果
        assert data["code"] != 0 or data.get("data", {}).get("reused") is True or data.get("data", {}).get("reuse_type") is not None
