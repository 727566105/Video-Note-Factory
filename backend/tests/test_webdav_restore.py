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
    assert data["code"] != 0


def test_restore_upload_rejects_bad_zip(client):
    """非 zip 文件被拒绝（前置校验仍在请求内同步完成）"""
    resp = client.post(
        "/api/webdav/restore/upload",
        files={"file": ("not_a_zip.zip", b"not really a zip", "application/zip")},
    )
    data = resp.json()
    assert data["code"] != 0


# ==================== 容错解压测试 ====================


def _make_zip_with_long_name(zip_path, db_filename="video_note.db"):
    """构造含超长文件名条目 + 正常条目 + DB 文件的 zip"""
    import zipfile
    # 超长文件名（>255 字节，触发 Linux 文件名长度限制）
    long_name = "a" * 300 + ".txt"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("normal.txt", "正常文件内容")
        zf.writestr(f"video/sub/{long_name}", "超长名文件内容")
        zf.writestr(db_filename, "fake db content")


def test_safe_extract_all_skips_long_filename(tmp_path):
    """_safe_extract_all 遇超长文件名条目跳过，正常条目落地"""
    from app.services.webdav_backup import _safe_extract_all, DB_FILENAME

    zip_path = tmp_path / "test.zip"
    _make_zip_with_long_name(zip_path, DB_FILENAME)

    dest = tmp_path / "extract"
    dest.mkdir()
    skipped = _safe_extract_all(zip_path, dest)

    # 正常文件落地
    assert (dest / "normal.txt").exists()
    # DB 文件落地（短名，不会超长）
    assert (dest / DB_FILENAME).exists()
    # 超长名条目被跳过
    assert len(skipped) == 1
    assert "a" * 300 in skipped[0]


def test_safe_extract_all_raises_on_db_failure(tmp_path):
    """数据库文件解压失败视为致命错误（无库则恢复无意义）"""
    import zipfile
    from app.services.webdav_backup import _safe_extract_all

    # 构造一个 zip，其中 DB 文件名超长，使 extract 触发 OSError
    long_db_name = "b" * 300 + ".db"
    zip_path = tmp_path / "test.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("normal.txt", "正常文件内容")
        zf.writestr(long_db_name, "fake db content")

    dest = tmp_path / "extract"
    dest.mkdir()

    import app.services.webdav_backup as wb
    original = wb.DB_FILENAME
    wb.DB_FILENAME = long_db_name
    try:
        with pytest.raises(Exception, match="数据库文件解压失败"):
            _safe_extract_all(zip_path, dest)
    finally:
        wb.DB_FILENAME = original


def test_format_skipped_files_truncates_and_limits():
    """_format_skipped_files 单条截断 80 字符，列表上限 20 条"""
    from app.services.webdav_backup import _format_skipped_files

    # 25 个条目，每个 100 字符
    names = ["x" * 100 for _ in range(25)]
    result = _format_skipped_files(names)

    assert len(result) == 20  # 上限 20
    assert all(name.endswith("…") for name in result)  # 每条都截断
    assert all(len(name) == 81 for name in result)  # 80 字符 + "…"
