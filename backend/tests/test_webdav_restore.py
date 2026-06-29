"""整机包导入异步化单元测试

验证 POST /webdav/restore/upload：
1. 异步化后立即返回 {started:true}，不被慢速 restore_from_local_file 阻塞
2. 已有任务在执行（is_busy）时拒绝重复导入

运行: cd backend && python3 -m pytest tests/test_webdav_restore.py -v
"""
import io
import time
import zipfile
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import webdav
from app.services import webdav_backup
from app.auth.dependencies import get_current_user


def _fake_user():
    return {"id": 1, "username": "admin", "role": "admin"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    """挂载 webdav 路由 + 绕过鉴权 + 隔离临时目录"""
    monkeypatch.setattr(webdav_backup, "BACKUP_TEMP_DIR", tmp_path, raising=False)
    # 重置全局恢复状态，避免受其它测试残留影响
    monkeypatch.setattr(webdav_backup, "_restore_in_progress", False, raising=False)
    monkeypatch.setattr(webdav_backup, "_backup_in_progress", False, raising=False)

    _app = FastAPI()
    _app.include_router(webdav.router, prefix="/api/webdav")
    _app.dependency_overrides[get_current_user] = _fake_user
    return TestClient(_app)


def _make_zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("dummy.txt", "x")
    buf.seek(0)
    return buf.getvalue()


def test_restore_upload_returns_started_immediately(client):
    """/restore/upload 立即返回 {started:true}，后台线程的慢恢复不阻塞响应"""
    invoked = {"count": 0}

    def slow_restore(zip_path, progress_callback=None):
        invoked["count"] += 1
        time.sleep(3)  # 模拟大整机包耗时恢复

    with patch("app.routers.webdav.restore_from_local_file", side_effect=slow_restore):
        start = time.time()
        resp = client.post(
            "/api/webdav/restore/upload",
            files={"file": ("test.zip", _make_zip_bytes(), "application/zip")},
        )
        elapsed = time.time() - start

    data = resp.json()
    assert resp.status_code == 200, data
    assert data["code"] == 0, data
    assert data["data"]["started"] is True
    # 响应应远快于慢恢复的 3s（证明异步化、未阻塞）
    assert elapsed < 2.0, f"响应耗时 {elapsed:.2f}s，疑似未异步化"


def test_restore_upload_rejects_when_busy(client, monkeypatch):
    """已有恢复任务在执行（is_busy）时，拒绝重复导入"""
    monkeypatch.setattr(webdav_backup, "_restore_in_progress", True, raising=False)

    resp = client.post(
        "/api/webdav/restore/upload",
        files={"file": ("test.zip", _make_zip_bytes(), "application/zip")},
    )
    data = resp.json()
    assert data["code"] != 0, "busy 时应返回错误码"
    assert "执行中" in data["msg"]


def test_restore_upload_rejects_bad_zip(client):
    """非 zip 文件被拒绝（前置校验仍在请求内同步完成）"""
    resp = client.post(
        "/api/webdav/restore/upload",
        files={"file": ("not_a_zip.zip", b"not really a zip", "application/zip")},
    )
    data = resp.json()
    assert data["code"] != 0
