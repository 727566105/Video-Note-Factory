"""WebDAV 健壮性与安全加固测试

覆盖：
- 远端恢复 restore_backup 重构后（下载路径字符串、回滚、dispose）
- 路径安全（backup_name 穿越、下载 resolve、symlink 跳过）
- 并发安全（threading.Lock 原子获取）
- 权限收紧（require_admin）
- 输入校验（Cron 表达式、Cookie JSON 合法性）

运行: cd backend && python3 -m pytest tests/test_webdav_hardening.py -v
"""
import json
import os
import stat
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import webdav as webdav_router
from app.services import webdav_backup
from app.services.webdav_backup import (
    WebDAVBackup, _safe_extract_all, acquire_backup_lock, release_backup_lock,
)
from app.auth.dependencies import get_current_user, get_current_user_flexible, require_admin


# ==================== helpers ====================

def _make_service():
    """构造不触发 WebDAV 配置读取的实例"""
    svc = WebDAVBackup.__new__(WebDAVBackup)
    svc.config = MagicMock()
    svc.config.path = "/"
    svc.client = None
    return svc


def _point(monkeypatch, root: Path):
    """重定向路径常量到 root 隔离目录"""
    root.mkdir(parents=True, exist_ok=True)
    (root / "video").mkdir(parents=True, exist_ok=True)
    (root / "backups").mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(webdav_backup, "VIDEO_DIR", root / "video")
    monkeypatch.setattr(webdav_backup, "NOTE_OUTPUT_DIR", root / "notes")
    monkeypatch.setattr(webdav_backup, "BACKUP_TEMP_DIR", root / "temp")
    monkeypatch.setattr(webdav_backup, "LOCAL_BACKUP_DIR", root / "backups")
    monkeypatch.setattr(webdav_backup, "DB_FILE", root / "video_note.db")
    monkeypatch.setattr(webdav_backup, "DB_FILENAME", "video_note.db")
    monkeypatch.setattr(webdav_backup, "COOKIE_CONFIG_FILE", root / "config" / "downloader.json")


def _seed_db(path: Path, rows=None):
    """建 video_tasks 表并插行"""
    import sqlite3
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE IF NOT EXISTS video_tasks (id INTEGER PRIMARY KEY, title TEXT)")
    if rows:
        con.executemany("INSERT OR REPLACE INTO video_tasks (id, title) VALUES (?, ?)", rows)
    con.commit()
    con.close()
    return path


def _zip_with_db(zip_path: Path, db_path: Path, extra: dict) -> Path:
    """构造含 DB + 额外条目的 zip"""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(db_path, "video_note.db")
        for arcname, data in extra.items():
            zf.writestr(arcname, data)
    return zip_path


# ==================== 路径安全 ====================

class TestPathSafety:
    """backup_name 路径穿越 + 下载 resolve 校验"""

    @pytest.fixture
    def app_client(self, tmp_path, monkeypatch):
        _point(monkeypatch, tmp_path / "root")
        webdav_backup.LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        # 创建一个合法的 zip 供下载测试
        (webdav_backup.LOCAL_BACKUP_DIR / "valid.zip").write_bytes(b"fake zip")
        _fake_admin = SimpleNamespace(id=1, username="admin", role="admin")
        _fake_user = SimpleNamespace(id=1, username="user", role="user")
        _app = FastAPI()
        _app.include_router(webdav_router.router, prefix="/api/webdav")
        _app.dependency_overrides[get_current_user] = lambda: _fake_user
        _app.dependency_overrides[require_admin] = lambda: _fake_admin
        _app.dependency_overrides[get_current_user_flexible] = lambda: _fake_admin
        return TestClient(_app)

    def test_backup_name_traversal_blocked(self, app_client):
        """backup_name 含路径穿越字符被 _sanitize_backup_name 净化或拒绝"""
        from app.routers.webdav import _sanitize_backup_name
        # os.path.basename 剥掉目录穿越部分 -> 只剩安全文件名（安全行为）
        assert _sanitize_backup_name("../../etc/passwd.zip") == "passwd.zip"
        # 非 zip 后缀 -> 拒绝
        assert _sanitize_backup_name("evil.sh") is None
        # 含特殊字符（空格、$ 等）-> 拒绝
        assert _sanitize_backup_name("evil name.zip") is None
        # 合法文件名 -> 通过
        assert _sanitize_backup_name("videonote_backup_20260711.zip") == "videonote_backup_20260711.zip"

    def test_backup_name_valid(self):
        from app.routers.webdav import _sanitize_backup_name
        assert _sanitize_backup_name("videonote_backup_20260711_000000.zip") == "videonote_backup_20260711_000000.zip"

    def test_backup_name_non_zip_rejected(self):
        from app.routers.webdav import _sanitize_backup_name
        assert _sanitize_backup_name("evil.sh") is None
        assert _sanitize_backup_name("evil.txt") is None

    def test_download_resolve_traversal_blocked(self, app_client):
        """下载端点 _sanitize_backup_name 对路径穿越变体的处理"""
        from app.routers.webdav import _sanitize_backup_name
        # %2F 编码 -> 含 % 被正则拒绝
        assert _sanitize_backup_name("..%2Fevil.zip") is None
        # normal/evil.zip -> basename 剥掉目录只剩 evil.zip（安全，无法穿越）
        assert _sanitize_backup_name("normal/evil.zip") == "evil.zip"
        # 合法文件名通过
        assert _sanitize_backup_name("valid.zip") == "valid.zip"

    def test_download_valid_file(self, app_client):
        """合法文件名正常下载"""
        resp = app_client.get("/api/webdav/backup/download/valid.zip")
        assert resp.status_code == 200


# ==================== symlink 防护 ====================

def test_safe_extract_skips_symlink(tmp_path, monkeypatch):
    """_safe_extract_all 跳过 zip 中的符号链接条目"""
    from app.services.webdav_backup import _safe_extract_all
    monkeypatch.setattr(webdav_backup, "DB_FILENAME", "video_note.db")

    zip_path = tmp_path / "evil.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # 正常 DB
        zf.writestr("video_note.db", "fake db")
        # 符号链接条目（external_attr 高 16 位 = S_IFLNK）
        symlink_info = zipfile.ZipInfo("evil_link")
        symlink_info.external_attr = (stat.S_IFLNK | 0o777) << 16
        zf.writestr(symlink_info, "/etc/passwd")

    dest = tmp_path / "extract"
    dest.mkdir()
    skipped = _safe_extract_all(zip_path, dest)

    assert "evil_link" in skipped, "符号链接应被跳过"
    assert not (dest / "evil_link").exists(), "符号链接文件不应落盘"


# ==================== 并发安全 ====================

def test_concurrent_backup_lock_atomic(tmp_path, monkeypatch):
    """acquire_backup_lock 原子获取：第二次调用应失败"""
    _point(monkeypatch, tmp_path)
    # 先手动重置
    monkeypatch.setattr(webdav_backup, "_backup_in_progress", False)
    monkeypatch.setattr(webdav_backup, "_restore_in_progress", False)

    assert acquire_backup_lock() is True, "首次获取应成功"
    assert acquire_backup_lock() is False, "第二次获取应失败（忙）"

    release_backup_lock()
    assert acquire_backup_lock() is True, "释放后再次获取应成功"
    release_backup_lock()


# ==================== Cron 校验 ====================

def test_cron_validation_accepts_valid():
    from app.routers.webdav import _validate_cron
    assert _validate_cron("0 2 * * *") is True
    assert _validate_cron("*/30 * * * *") is True
    assert _validate_cron("0 0 1 * 0") is True


def test_cron_validation_rejects_invalid():
    from app.routers.webdav import _validate_cron
    assert _validate_cron("abc def") is False
    assert _validate_cron("0 2") is False
    assert _validate_cron("0 2 * * * *") is False  # 6 段
    assert _validate_cron("99 99 * * *") is False  # 超范围


def test_config_request_rejects_bad_cron():
    """WebDAVConfigRequest 非法 cron 应被 pydantic 拒绝"""
    from app.routers.webdav import WebDAVConfigRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        WebDAVConfigRequest(
            url="http://example.com", username="u", password="p",
            auto_backup_schedule="bad cron"
        )


# ==================== Cookie JSON 校验 ====================

def test_cookie_restore_skips_invalid_json(tmp_path, monkeypatch):
    """恢复时 Cookie 文件 JSON 非法则跳过不报错"""
    from app.services.webdav_backup import restore_from_local_file
    _point(monkeypatch, tmp_path)

    # 构造一个含 DB + 损坏 Cookie 的 zip
    db = tmp_path / "_src" / "video_note.db"
    _seed_db(db, [(1, "t")])
    bad_cookie = "this is not json {{{"
    zip_path = _zip_with_db(
        tmp_path / "pkg.zip", db,
        {webdav_backup.COOKIE_ARCNAME: bad_cookie},
    )
    # 不应抛异常
    result = restore_from_local_file(zip_path)
    assert result["success"] is True
    # Cookie 文件不应被写入（非法 JSON 被跳过）
    assert not webdav_backup.COOKIE_CONFIG_FILE.exists()


# ==================== 远端恢复重构 ====================

class TestRemoteRestore:
    """restore_backup 重构：下载路径字符串 + 回滚 + dispose"""

    def test_download_uses_path_string_not_file_object(self, tmp_path, monkeypatch):
        """download_sync 应收到路径字符串，而非文件对象"""
        _point(monkeypatch, tmp_path)
        monkeypatch.setattr(webdav_backup, "_restore_in_progress", False)
        monkeypatch.setattr(webdav_backup, "_backup_in_progress", False)

        svc = _make_service()
        svc.config.path = "/"

        download_args = {}

        def fake_download(remote, local):
            download_args["remote"] = remote
            download_args["local"] = local
            # 模拟下载一个合法 zip 到 local 路径
            db_src = tmp_path / "_seed" / "video_note.db"
            _seed_db(db_src, [(1, "remote")])
            _zip_with_db(Path(local), db_src, {})

        svc.client = MagicMock()
        svc.client.download_sync = fake_download

        svc.restore_backup("videonote_backup_20260711.zip")

        # download_sync 第二参数必须是 str（路径），不能是文件对象
        assert isinstance(download_args["local"], str), \
            "download_sync 应收到路径字符串，而非文件对象"

    def test_remote_restore_rollback_on_failure(self, tmp_path, monkeypatch):
        """远端恢复失败时回滚 DB+video+cookie"""
        _point(monkeypatch, tmp_path)
        monkeypatch.setattr(webdav_backup, "_restore_in_progress", False)
        monkeypatch.setattr(webdav_backup, "_backup_in_progress", False)

        # 目标原始数据
        (webdav_backup.VIDEO_DIR / "orig").mkdir(parents=True)
        (webdav_backup.VIDEO_DIR / "orig" / "note.md").write_text("original")
        _seed_db(webdav_backup.DB_FILE, [(1, "original")])
        orig_db_bytes = webdav_backup.DB_FILE.read_bytes()

        svc = _make_service()

        def fake_download(remote, local):
            # 下载一个合法 zip（含新数据）
            db_src = tmp_path / "_seed" / "video_note.db"
            _seed_db(db_src, [(1, "new")])
            _zip_with_db(Path(local), db_src, {
                "video/new/note.md": "new content",
            })

        svc.client = MagicMock()
        svc.client.download_sync = fake_download

        # 注入：_replace_dir 第 1 次调用抛异常
        original_replace = WebDAVBackup._replace_dir
        counter = {"n": 0}

        def boom(src_d, dest_d):
            counter["n"] += 1
            if counter["n"] == 1:
                raise RuntimeError("注入失败")
            return original_replace(src_d, dest_d)

        monkeypatch.setattr(WebDAVBackup, "_replace_dir", staticmethod(boom))

        with pytest.raises(RuntimeError, match="注入失败"):
            svc.restore_backup("test.zip")

        # 回滚后：DB 回到原始，video 回到原始
        assert webdav_backup.DB_FILE.read_bytes() == orig_db_bytes
        assert (webdav_backup.VIDEO_DIR / "orig" / "note.md").read_text() == "original"
        assert not (webdav_backup.VIDEO_DIR / "new").exists(), "恢复的文件应被回滚清除"

    def test_remote_restore_calls_engine_dispose(self, tmp_path, monkeypatch):
        """远端恢复替换 DB 前应调 engine.dispose()"""
        _point(monkeypatch, tmp_path)
        monkeypatch.setattr(webdav_backup, "_restore_in_progress", False)
        monkeypatch.setattr(webdav_backup, "_backup_in_progress", False)

        svc = _make_service()

        def fake_download(remote, local):
            db_src = tmp_path / "_seed" / "video_note.db"
            _seed_db(db_src, [(1, "x")])
            _zip_with_db(Path(local), db_src, {})

        svc.client = MagicMock()
        svc.client.download_sync = fake_download

        dispose_called = {"n": 0}
        original_dispose = webdav_backup.engine.dispose if hasattr(webdav_backup, 'engine') else None

        with patch("app.db.engine.engine") as mock_engine:
            mock_engine.dispose.side_effect = lambda: dispose_called.__setitem__("n", dispose_called["n"] + 1)
            svc.restore_backup("test.zip")

        assert dispose_called["n"] >= 1, "engine.dispose() 应被调用"


# ==================== 权限收紧 ====================

class TestAdminRequired:
    """非 admin 用户调写/删/恢复端点应被拒"""

    @pytest.fixture
    def app_with_regular_user(self, tmp_path, monkeypatch):
        """普通用户（非 admin）的 TestClient"""
        _point(monkeypatch, tmp_path / "root")
        _fake_user = SimpleNamespace(id=1, username="user", role="user")
        _app = FastAPI()
        _app.include_router(webdav_router.router, prefix="/api/webdav")
        _app.dependency_overrides[get_current_user] = lambda: _fake_user
        # 不 override require_admin → 真实 require_admin 会检查 role
        return TestClient(_app)

    def test_non_admin_cannot_save_config(self, app_with_regular_user):
        """普通用户不能保存配置"""
        resp = app_with_regular_user.post("/api/webdav/config", json={
            "url": "http://example.com", "username": "u", "password": "p"
        })
        assert resp.status_code == 403

    def test_non_admin_cannot_restore_upload(self, app_with_regular_user):
        """普通用户不能上传恢复"""
        import io
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("x", "x")
        buf.seek(0)
        resp = app_with_regular_user.post(
            "/api/webdav/restore/upload",
            files={"file": ("test.zip", buf, "application/zip")},
        )
        assert resp.status_code == 403

    def test_non_admin_can_read_config(self, app_with_regular_user):
        """普通用户可以读配置（只读端点不变）"""
        resp = app_with_regular_user.get("/api/webdav/config")
        assert resp.status_code == 200
