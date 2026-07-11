"""整机备份/恢复单元测试
运行: cd backend && python3 -m pytest tests/test_backup.py -v
"""
from pathlib import Path
from app.services import webdav_backup


def _make_service():
    """构造一个不触发 WebDAV 配置读取的 WebDAVBackup 实例"""
    svc = webdav_backup.WebDAVBackup.__new__(webdav_backup.WebDAVBackup)
    svc.config = None
    svc.client = None
    return svc


def test_collect_includes_video_dir_excludes_pending(tmp_path, monkeypatch):
    """_collect_backup_files 应收集 VIDEO_DIR 文件并排除 _pending"""
    video = tmp_path / "video" / "bilibili" / "auth_1" / "vid_1"
    video.mkdir(parents=True)
    (video / "note.md").write_text("# note", encoding="utf-8")
    (video / "cover.jpg").write_bytes(b"img")
    pending = tmp_path / "video" / "_pending" / "task_x"
    pending.mkdir(parents=True)
    (pending / "tmp.txt").write_text("x", encoding="utf-8")

    monkeypatch.setattr(webdav_backup, "VIDEO_DIR", tmp_path / "video", raising=False)
    monkeypatch.setattr(webdav_backup, "DB_FILE", None)

    files = _make_service()._collect_backup_files()
    names = [str(f) for f in files]

    assert any(p.endswith("note.md") for p in names)
    assert any(p.endswith("cover.jpg") for p in names)
    assert not any("_pending" in p for p in names), "不应收集 _pending 临时目录"


def test_zip_structure_uses_video_arcname(tmp_path, monkeypatch):
    """打包 zip 内媒体文件 arcname 以 video/ 开头"""
    video = tmp_path / "video" / "douyin" / "a" / "v"
    video.mkdir(parents=True)
    (video / "note.md").write_text("# t", encoding="utf-8")

    monkeypatch.setattr(webdav_backup, "VIDEO_DIR", tmp_path / "video", raising=False)
    monkeypatch.setattr(webdav_backup, "DB_FILE", None)
    monkeypatch.setattr(webdav_backup, "BACKUP_TEMP_DIR", tmp_path / "tmp")
    monkeypatch.setattr(
        "app.services.config_export.ConfigExporter.save_configs_file",
        lambda include_sensitive=True: None,
    )

    svc = _make_service()
    zip_path = svc._create_zip_archive([video / "note.md"])
    import zipfile
    with zipfile.ZipFile(zip_path) as zf:
        assert any(n.startswith("video/") for n in zf.namelist())


def test_create_backup_local_keeps_zip(tmp_path, monkeypatch):
    """target=local 时不上传 WebDAV，保留 zip 到 LOCAL_BACKUP_DIR"""
    video = tmp_path / "video" / "p" / "a" / "v"
    video.mkdir(parents=True)
    (video / "note.md").write_text("# t", encoding="utf-8")
    db = tmp_path / "video_note.db"
    db.write_bytes(b"db")

    monkeypatch.setattr(webdav_backup, "VIDEO_DIR", tmp_path / "video")
    monkeypatch.setattr(webdav_backup, "DB_FILE", db)
    monkeypatch.setattr(webdav_backup, "DB_FILENAME", "video_note.db")
    monkeypatch.setattr(webdav_backup, "BACKUP_TEMP_DIR", tmp_path / "tmp")
    monkeypatch.setattr(webdav_backup, "LOCAL_BACKUP_DIR", tmp_path / "backups")
    monkeypatch.setattr(
        "app.services.config_export.ConfigExporter.save_configs_file",
        lambda include_sensitive=True: None,
    )
    monkeypatch.setattr(
        "app.services.webdav_backup.add_backup_record",
        lambda **kw: None,
    )

    svc = _make_service()
    result = svc.create_backup(backup_type="manual", target="local")

    assert result["success"] is True
    assert "filename" in result
    saved = tmp_path / "backups" / result["filename"]
    assert saved.exists(), "local 模式 zip 应保留在 LOCAL_BACKUP_DIR"


def test_local_backup_endpoint_starts_async(tmp_path, monkeypatch):
    """POST /backup/local 立即返回 started，且最终触发 create_backup(target=local)"""
    import time
    called = {"target": None}

    def _fake_create(self, backup_type="manual", target="webdav", progress_callback=None, **kwargs):
        called["target"] = target
        return {"success": True, "filename": "x.zip"}

    monkeypatch.setattr(webdav_backup.WebDAVBackup, "create_backup", _fake_create)
    monkeypatch.setattr(webdav_backup, "LOCAL_BACKUP_DIR", tmp_path / "backups")

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from types import SimpleNamespace
    from app.routers import webdav as webdav_router
    app = FastAPI()
    app.include_router(webdav_router.router, prefix="/api/webdav")
    client = TestClient(app)

    _fake_admin = SimpleNamespace(id=1, username="admin", role="admin")
    from app.auth.dependencies import get_current_user, require_admin
    app.dependency_overrides[get_current_user] = lambda: _fake_admin
    app.dependency_overrides[require_admin] = lambda: _fake_admin

    resp = client.post("/api/webdav/backup/local")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["started"] is True
    for _ in range(50):
        if called["target"] is not None:
            break
        time.sleep(0.1)
    assert called["target"] == "local"


def test_download_local_backup(tmp_path, monkeypatch):
    """下载接口返回 zip 内容，并拦截路径穿越"""
    backups_dir = tmp_path / "backups"
    backups_dir.mkdir()
    (backups_dir / "videonote_backup_x.zip").write_bytes(b"PKzip")
    monkeypatch.setattr("app.routers.webdav.LOCAL_BACKUP_DIR", backups_dir)

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers import webdav as webdav_router
    app = FastAPI()
    app.include_router(webdav_router.router, prefix="/api/webdav")
    from app.auth.dependencies import get_current_user_flexible
    app.dependency_overrides[get_current_user_flexible] = lambda: {"id": 1}
    client = TestClient(app)

    resp = client.get("/api/webdav/backup/download/videonote_backup_x.zip")
    assert resp.status_code == 200
    assert resp.content == b"PKzip"

    # 路径穿越应被拦截（不返回系统文件内容；可能 400/404 或业务错误）
    bad = client.get("/api/webdav/backup/download/..%2F..%2Fetc%2Fpasswd")
    assert b"root:" not in bad.content


def test_list_local_backups(tmp_path, monkeypatch):
    """列表接口返回本地整机包（按文件名倒序）"""
    backups_dir = tmp_path / "backups"
    backups_dir.mkdir()
    (backups_dir / "videonote_backup_b.zip").write_bytes(b"bb")
    (backups_dir / "videonote_backup_a.zip").write_bytes(b"aa")
    monkeypatch.setattr("app.routers.webdav.LOCAL_BACKUP_DIR", backups_dir)

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers import webdav as webdav_router
    app = FastAPI()
    app.include_router(webdav_router.router, prefix="/api/webdav")
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": 1}
    client = TestClient(app)

    resp = client.get("/api/webdav/backup/local")
    assert resp.status_code == 200
    names = [b["name"] for b in resp.json()["data"]["backups"]]
    assert names == ["videonote_backup_b.zip", "videonote_backup_a.zip"]
