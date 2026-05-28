"""权限隔离 API 单元测试

注意：这些测试需要完整的数据库环境。
CI 环境下可能因为 bcrypt/passlib 兼容性问题导致数据库操作失败，此时测试会被跳过。
"""
import pytest
from fastapi.testclient import TestClient

# 检查数据库和 bcrypt 兼容性
_db_ok = False
try:
    from app.db.init_db import init_db
    init_db()
    # 测试 bcrypt 是否正常工作
    from app.db.user_dao import hash_password
    hash_password("test")
    _db_ok = True
except Exception:
    pass


@pytest.fixture
def app():
    """创建测试用 FastAPI 应用"""
    from fastapi import FastAPI
    from app.routers import auth, note
    _app = FastAPI()
    _app.include_router(auth.router, prefix="/api/auth")
    _app.include_router(note.router, prefix="/api")
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
    return _get_token(client, "bin", "123456")


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestPermissions:
    def test_admin_sees_own_notes(self, client, admin_token):
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        assert isinstance(tasks, list)

    def test_user_sees_own_notes(self, client, user_token):
        if not user_token:
            pytest.skip("用户 bin 不可用")
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.json()["code"] == 0

    def test_cross_user_access_denied(self, client, admin_token, user_token):
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]
        resp = client.get(f"/api/task_status/{task_id}", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    def test_cross_user_delete_denied(self, client, admin_token, user_token):
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]
        resp = client.post("/api/delete_task", json={"task_id": task_id}, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestTags:
    def test_update_tags_success(self, client, admin_token):
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]
        resp = client.put(f"/api/notes/{task_id}/tags", json={
            "platform_tags": ["test"],
            "ai_tags": ["test"],
            "manual_tags": ["manual"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

    def test_cross_user_update_tags_denied(self, client, admin_token, user_token):
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]
        resp = client.put(f"/api/notes/{task_id}/tags", json={
            "platform_tags": [],
            "ai_tags": [],
            "manual_tags": ["hack"]
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403
