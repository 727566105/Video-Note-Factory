"""整机备份/恢复 —— 真实导入端到端测试
运行: cd backend && python3 -m pytest tests/test_backup_import.py -v

被测: app.services.webdav_backup.restore_from_local_file（整机迁移导入路径）
本文件不修改生产代码，断言当前实现行为。
"""
import inspect
import json
import sqlite3
import zipfile
from pathlib import Path

import pytest

from app.services import webdav_backup
from app.services.webdav_backup import WebDAVBackup, restore_from_local_file


# ==================== helpers ====================

def _make_service():
    """构造不触发 WebDAV 配置读取的实例（与 tests/test_backup.py 一致）"""
    svc = WebDAVBackup.__new__(WebDAVBackup)
    svc.config = None
    svc.client = None
    return svc


def _point(monkeypatch, root: Path):
    """把 webdav_backup 的所有路径常量重定向到 root 下的隔离目录"""
    root.mkdir(parents=True, exist_ok=True)
    (root / "video").mkdir(parents=True, exist_ok=True)
    (root / "backups").mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(webdav_backup, "VIDEO_DIR", root / "video")
    monkeypatch.setattr(webdav_backup, "NOTE_OUTPUT_DIR", root / "notes")
    monkeypatch.setattr(webdav_backup, "BACKUP_TEMP_DIR", root / "temp")
    monkeypatch.setattr(webdav_backup, "LOCAL_BACKUP_DIR", root / "backups")
    monkeypatch.setattr(webdav_backup, "DB_FILE", root / "video_note.db")
    monkeypatch.setattr(webdav_backup, "DB_FILENAME", "video_note.db")


def _seed_db(path: Path, rows):
    """建 video_tasks(id,title) 表并插行（OR REPLACE 保证可重入）"""
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE IF NOT EXISTS video_tasks (id INTEGER PRIMARY KEY, title TEXT)")
    con.executemany("INSERT OR REPLACE INTO video_tasks (id, title) VALUES (?, ?)", rows)
    con.commit()
    con.close()
    return path


def _db_rows(path: Path):
    con = sqlite3.connect(path)
    rows = list(con.execute("SELECT id, title FROM video_tasks ORDER BY id"))
    con.close()
    return rows


def _stub_export(monkeypatch):
    """打桩 create_backup 的外部依赖，避免碰真实配置/DB"""
    monkeypatch.setattr(
        "app.services.config_export.ConfigExporter.save_configs_file",
        lambda include_sensitive=True: None,
    )
    monkeypatch.setattr("app.services.webdav_backup.add_backup_record", lambda **kw: None)


def _export_local() -> Path:
    """用 _make_service 跑一次 target=local 导出，返回 zip 绝对路径"""
    res = _make_service().create_backup(backup_type="manual", target="local")
    return webdav_backup.LOCAL_BACKUP_DIR / res["filename"]


def _zip_with_db(zip_path: Path, db_path: Path, extra: dict) -> Path:
    """构造一个含 DB（从文件读字节）+ 额外条目（arcname→bytes/text）的 zip"""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(db_path, "video_note.db")
        for arcname, data in extra.items():
            if isinstance(data, bytes):
                zf.write(data, arcname) if Path(data).exists() else zf.writestr(arcname, data)
            else:
                zf.writestr(arcname, data)
    return zip_path


# ==================== ① 数据完整性往返 ====================

def test_roundtrip_media_files_match(tmp_path, monkeypatch):
    """export→import 后媒体文件存在且字节一致；_pending 被排除"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"

    # 源：多级目录媒体 + _pending
    _point(monkeypatch, src)
    v = webdav_backup.VIDEO_DIR / "bilibili" / "auth_1" / "vid_1"
    v.mkdir(parents=True)
    (v / "note.md").write_text("# t", encoding="utf-8")
    (v / "cover.jpg").write_bytes(b"img-bytes")
    (v / "audio.mp3").write_bytes(b"audio-bytes")
    pend = webdav_backup.VIDEO_DIR / "_pending" / "task_x"
    pend.mkdir(parents=True)
    (pend / "tmp.txt").write_text("x", encoding="utf-8")
    _seed_db(webdav_backup.DB_FILE, [(1, "t1")])  # collect 需要 DB
    _stub_export(monkeypatch)
    zip_path = _export_local()

    # 切到空目标
    _point(monkeypatch, tgt)
    restore_from_local_file(zip_path)

    out = tgt / "video" / "bilibili" / "auth_1" / "vid_1"
    assert (out / "note.md").read_text() == "# t"
    assert (out / "cover.jpg").read_bytes() == b"img-bytes"
    assert (out / "audio.mp3").read_bytes() == b"audio-bytes"
    assert not (tgt / "video" / "_pending").exists(), "_pending 不应被导出/导入"
