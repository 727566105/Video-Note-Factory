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


def test_roundtrip_db_rows_match(tmp_path, monkeypatch):
    """DB 行经 export→import 完整找回"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "x").mkdir()
    (webdav_backup.VIDEO_DIR / "x" / "note.md").write_text("# t")
    _seed_db(webdav_backup.DB_FILE, [(1, "alpha"), (2, "beta"), (3, "gamma")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    assert not (tgt / "video_note.db").exists(), "目标初始应无 DB"
    restore_from_local_file(zip_path)
    assert _db_rows(tgt / "video_note.db") == [(1, "alpha"), (2, "beta"), (3, "gamma")]


def test_configs_restore_invokes_daos(tmp_path, monkeypatch):
    """configs.json 中的 webdav/siyuan/providers 被对应 DAO 写回（真实密钥）"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    calls = {"webdav": [], "siyuan": [], "insert": [], "update": [], "get": []}
    monkeypatch.setattr("app.db.webdav_config_dao.upsert_config",
                        lambda **kw: calls["webdav"].append(kw))
    monkeypatch.setattr("app.db.siyuan_config_dao.upsert_config",
                        lambda **kw: calls["siyuan"].append(kw))
    monkeypatch.setattr("app.db.provider_dao.get_provider_by_id",
                        lambda pid: (calls["get"].append(pid), None)[1])
    monkeypatch.setattr("app.db.provider_dao.insert_provider",
                        lambda **kw: calls["insert"].append(kw))
    monkeypatch.setattr("app.db.provider_dao.update_provider",
                        lambda *a, **kw: calls["update"].append((a, kw)))

    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {
        "webdav_config": {"url": "http://w", "username": "u", "password": "realpwd",
                          "path": "/", "auto_backup_enabled": 1, "auto_backup_schedule": "0 2 * * *"},
        "siyuan_config": {"api_url": "http://s", "api_token": "realtoken", "default_notebook": "nb"},
        "providers": [
            {"id": 1, "name": "p1", "api_key": "k1", "base_url": "u", "logo": "", "type": "openai", "enabled": 1},
            {"id": 2, "name": "p2", "api_key": "k2", "base_url": "u", "logo": "", "type": "openai", "enabled": 1},
        ],
    }}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert len(calls["webdav"]) == 1 and calls["webdav"][0]["password"] == "realpwd"
    assert len(calls["siyuan"]) == 1 and calls["siyuan"][0]["api_token"] == "realtoken"
    assert len(calls["insert"]) == 2, "两个 provider 都应 insert（get 返回 None）"
    assert {c["id"] for c in calls["insert"]} == {1, 2}


def test_configs_with_placeholder_secrets_skipped(tmp_path, monkeypatch):
    """密码/Key 为占位符 '********' 时对应 DAO 不应被调用"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    calls = {"webdav": 0, "siyuan": 0, "insert": 0, "update": 0}
    monkeypatch.setattr("app.db.webdav_config_dao.upsert_config",
                        lambda **kw: calls.__setitem__("webdav", calls["webdav"] + 1))
    monkeypatch.setattr("app.db.siyuan_config_dao.upsert_config",
                        lambda **kw: calls.__setitem__("siyuan", calls["siyuan"] + 1))
    monkeypatch.setattr("app.db.provider_dao.get_provider_by_id", lambda pid: None)
    monkeypatch.setattr("app.db.provider_dao.insert_provider",
                        lambda **kw: calls.__setitem__("insert", calls["insert"] + 1))
    monkeypatch.setattr("app.db.provider_dao.update_provider",
                        lambda *a, **kw: calls.__setitem__("update", calls["update"] + 1))

    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {
        "webdav_config": {"password": "********", "url": "http://w", "username": "u",
                          "path": "/", "auto_backup_enabled": 0, "auto_backup_schedule": "0 2 * * *"},
        "siyuan_config": {"api_token": "********", "api_url": "http://s", "default_notebook": None},
        "providers": [{"id": 1, "name": "p", "api_key": "********", "base_url": "", "logo": "", "type": "", "enabled": 1}],
    }}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert calls == {"webdav": 0, "siyuan": 0, "insert": 0, "update": 0}, "占位符密钥应全部跳过"
