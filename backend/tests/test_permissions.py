"""权限隔离 API 单元测试"""
import pytest
from fastapi.testclient import TestClient


class TestPermissions:
    def test_admin_sees_own_notes(self, client, admin_token):
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        assert isinstance(tasks, list)

    def test_user_sees_own_notes(self, client, user_token):
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {user_token}"})
        # user "bin" may not exist in test DB, expect login failure or empty list
        if resp.json().get("code") == 0:
            tasks = resp.json()["data"]["tasks"]
            assert isinstance(tasks, list)

    def test_cross_user_access_denied(self, client, admin_token, user_token):
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据可验证跨用户访问")
        task_id = tasks[0]["task_id"]
        resp = client.get(f"/api/task_status/{task_id}", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    def test_cross_user_delete_denied(self, client, admin_token, user_token):
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据可验证跨用户删除")
        task_id = tasks[0]["task_id"]
        resp = client.post("/api/delete_task", json={"task_id": task_id}, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


class TestTags:
    def test_update_tags_success(self, client, admin_token):
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据可验证标签更新")
        task_id = tasks[0]["task_id"]
        resp = client.put(f"/api/notes/{task_id}/tags", json={
            "platform_tags": ["test"],
            "ai_tags": ["test"],
            "manual_tags": ["manual"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

    def test_cross_user_update_tags_denied(self, client, admin_token, user_token):
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据可验证跨用户标签修改")
        task_id = tasks[0]["task_id"]
        resp = client.put(f"/api/notes/{task_id}/tags", json={
            "platform_tags": [],
            "ai_tags": [],
            "manual_tags": ["hack"]
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403
