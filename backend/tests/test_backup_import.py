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
    monkeypatch.setattr(webdav_backup, "COOKIE_CONFIG_FILE", root / "config" / "downloader.json")


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


# ==================== ② 整体替换语义 + gap ====================

def test_roundtrip_cookie_file_restored(tmp_path, monkeypatch):
    """平台 Cookie 文件（config/downloader.json）经 export→import 完整还原"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    # 源端写一个 Cookie 文件
    webdav_backup.COOKIE_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    cookie_data = {"douyin": {"cookie": "sid=abc; token=xyz"}, "bilibili": {"cookie": "SESSDATA=123"}}
    webdav_backup.COOKIE_CONFIG_FILE.write_text(json.dumps(cookie_data, ensure_ascii=False), encoding="utf-8")
    (webdav_backup.VIDEO_DIR / "x").mkdir()
    (webdav_backup.VIDEO_DIR / "x" / "note.md").write_text("# t")
    _seed_db(webdav_backup.DB_FILE, [(1, "t1")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    # 切到空目标
    _point(monkeypatch, tgt)
    restore_from_local_file(zip_path)

    # Cookie 文件应完整还原
    assert webdav_backup.COOKIE_CONFIG_FILE.exists(), "Cookie 配置文件应被恢复"
    restored = json.loads(webdav_backup.COOKIE_CONFIG_FILE.read_text(encoding="utf-8"))
    assert restored == cookie_data, "Cookie 内容应字节级一致"


def test_roundtrip_cookie_absent_no_error(tmp_path, monkeypatch):
    """源端没有 Cookie 文件时，导出的包不含 Cookie，导入也不报错"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "x").mkdir()
    (webdav_backup.VIDEO_DIR / "x" / "note.md").write_text("# t")
    _seed_db(webdav_backup.DB_FILE, [(1, "t1")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    restore_from_local_file(zip_path)
    # 没有 Cookie 文件是正常的（旧包兼容）
    assert not webdav_backup.COOKIE_CONFIG_FILE.exists()


def test_configs_restore_obsidian(tmp_path, monkeypatch):
    """configs.json 中的 obsidian_config 被对应 DAO 写回（真实 api_key）"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    calls = {"obsidian": []}
    monkeypatch.setattr("app.db.obsidian_config_dao.upsert_config",
                        lambda **kw: calls["obsidian"].append(kw))

    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {
        "obsidian_config": {
            "export_mode": "api", "vault_path": "/vault", "folder_path": "vn/",
            "attachments_folder": "att/", "api_url": "http://o:8080",
            "api_key": "realkey", "enabled": 1,
        },
    }}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert len(calls["obsidian"]) == 1
    c = calls["obsidian"][0]
    assert c["api_key"] == "realkey"
    assert c["export_mode"] == "api"


def test_configs_obsidian_local_mode_no_key(tmp_path, monkeypatch):
    """Obsidian local 模式不需要 api_key，应正常恢复"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    calls = {"obsidian": []}
    monkeypatch.setattr("app.db.obsidian_config_dao.upsert_config",
                        lambda **kw: calls["obsidian"].append(kw))

    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {
        "obsidian_config": {
            "export_mode": "local", "vault_path": "/vault", "folder_path": "vn/",
            "attachments_folder": "att/", "api_url": "", "api_key": "", "enabled": 1,
        },
    }}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert len(calls["obsidian"]) == 1, "local 模式应恢复（无需 api_key）"


def test_configs_obsidian_api_placeholder_skipped(tmp_path, monkeypatch):
    """Obsidian api 模式但 api_key 为占位符时跳过"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    calls = {"obsidian": []}
    monkeypatch.setattr("app.db.obsidian_config_dao.upsert_config",
                        lambda **kw: calls["obsidian"].append(kw))

    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {
        "obsidian_config": {
            "export_mode": "api", "vault_path": "", "folder_path": "",
            "attachments_folder": "", "api_url": "", "api_key": "********", "enabled": 1,
        },
    }}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert len(calls["obsidian"]) == 0, "api 模式 + 占位符应跳过"


def test_import_replaces_video_dir_whole(tmp_path, monkeypatch):
    """目标 video 里的'孤儿文件'应被整体替换清掉（_replace_dir 删除重建）"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "bilibili" / "a" / "v").mkdir(parents=True)
    (webdav_backup.VIDEO_DIR / "bilibili" / "a" / "v" / "note.md").write_text("# src")
    _seed_db(webdav_backup.DB_FILE, [(1, "s")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    orphan = webdav_backup.VIDEO_DIR / "douyin" / "orphan" / "v"
    orphan.mkdir(parents=True)
    (orphan / "orphan.md").write_text("# orphan")
    restore_from_local_file(zip_path)

    assert (tgt / "video" / "bilibili" / "a" / "v" / "note.md").read_text() == "# src"
    assert not (tgt / "video" / "douyin" / "orphan").exists(), "孤儿目录应被整体替换清掉"


def test_import_replaces_db_whole(tmp_path, monkeypatch):
    """目标 DB 里的额外行应被文件级覆盖清掉"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "x").mkdir()
    (webdav_backup.VIDEO_DIR / "x" / "note.md").write_text("# t")
    _seed_db(webdav_backup.DB_FILE, [(1, "src")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "tgt-original"), (2, "extra-will-vanish")])
    restore_from_local_file(zip_path)
    assert _db_rows(tgt / "video_note.db") == [(1, "src")], "额外行应被覆盖消失"


def test_gap_configs_do_not_delete_absent_providers(tmp_path, monkeypatch):
    """【已知 gap】备份里没有的 provider 不会被删除，目标里的旧 provider 残留"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    existing = {1: {"id": 1, "name": "P_old"}}  # 目标已有 provider id=1
    inserted, updated = [], []
    monkeypatch.setattr("app.db.provider_dao.get_provider_by_id",
                        lambda pid: existing.get(pid))
    monkeypatch.setattr("app.db.provider_dao.insert_provider",
                        lambda **kw: inserted.append(kw))
    monkeypatch.setattr("app.db.provider_dao.update_provider",
                        lambda *a, **kw: updated.append((a, kw)))

    # 备份里只有 provider id=2
    cfg = {"version": "1.0", "exported_at": "2026-06-26T00:00:00", "configs": {"providers": [
        {"id": 2, "name": "P_new", "api_key": "k", "base_url": "u", "logo": "", "type": "openai", "enabled": 1}]}}
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "x")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db, {"configs.json": json.dumps(cfg, ensure_ascii=False)})
    restore_from_local_file(zip_path)

    assert [c["id"] for c in inserted] == [2], "只应 insert 备份中的 id=2"
    assert 1 in existing, "目标原有的 id=1 既未被查询也未被删除 → 残留（gap）"


def test_gap_rollback_does_not_restore_db_configs():
    """【已知 gap】_rollback_restore 不含 DB 配置还原逻辑（静态契约）

    回滚会还原 DB 文件 + video + note_results + Cookie 文件，
    但不会还原 DB 里的 configs（providers/siyuan/webdav/obsidian）--那些靠
    DB 文件级覆盖已经回滚了，不需要单独的 _restore_configs 调用。
    """
    src = inspect.getsource(webdav_backup._rollback_restore).lower()
    assert "_restore_configs" not in src, "回滚不应调用 _restore_configs"
    assert "downloader.json" in src, "回滚应包含 Cookie 文件还原"


# ==================== ③ 回滚 / 失败注入 ====================

def test_pre_restore_snapshot_captured(tmp_path, monkeypatch):
    """成功导入后，pre_restore 快照目录应留存且含 DB+video+note_results"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    # 目标原始内容
    (webdav_backup.VIDEO_DIR / "a").mkdir()
    (webdav_backup.VIDEO_DIR / "a" / "f.md").write_text("v")
    webdav_backup.NOTE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (webdav_backup.NOTE_OUTPUT_DIR / "n.md").write_text("n")
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    # 源包
    db2 = tgt / "_src" / "video_note.db"
    _seed_db(db2, [(1, "new")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db2, {})

    restore_from_local_file(zip_path)

    snaps = list((tgt / "temp").glob("pre_restore_*"))
    assert len(snaps) == 1, "应恰好建立一个 pre_restore 快照"
    snap = snaps[0]
    assert (snap / "video_note.db").exists()
    assert (snap / "video" / "a" / "f.md").exists()
    assert (snap / "note_results" / "n.md").exists()


def test_rollback_restores_db_and_video_on_failure(tmp_path, monkeypatch):
    """恢复中途失败后，DB 与 video 应完全回滚到导入前"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "a").mkdir()
    (webdav_backup.VIDEO_DIR / "a" / "src.md").write_text("src")
    _seed_db(webdav_backup.DB_FILE, [(1, "src")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    (webdav_backup.VIDEO_DIR / "a").mkdir()
    (webdav_backup.VIDEO_DIR / "a" / "orig.md").write_text("orig")
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    orig_db_hash = (tgt / "video_note.db").read_bytes()

    # 注入：_replace_dir 第 1 次调用抛异常（恢复 video 时），之后恢复原行为供回滚用
    original = WebDAVBackup._replace_dir
    counter = {"n": 0}

    def boom(src_d, dest_d):
        counter["n"] += 1
        if counter["n"] == 1:
            raise RuntimeError("注入失败")
        return original(src_d, dest_d)

    monkeypatch.setattr(WebDAVBackup, "_replace_dir", staticmethod(boom))

    with pytest.raises(RuntimeError, match="注入失败"):
        restore_from_local_file(zip_path)

    # 回滚后：DB 字节 + video 内容都应回到导入前
    assert (tgt / "video_note.db").read_bytes() == orig_db_hash
    assert (webdav_backup.VIDEO_DIR / "a" / "orig.md").read_text() == "orig"
    assert not (webdav_backup.VIDEO_DIR / "a" / "src.md").exists()


# ==================== ④ 边界 / 安全 ====================

def test_import_missing_db_raises(tmp_path, monkeypatch):
    """zip 只有 video、无 DB → 抛'缺少数据库'"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    zip_path = tgt / "pkg.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("video/a/note.md", "# t")
    with pytest.raises(Exception, match="缺少数据库"):
        restore_from_local_file(zip_path)


def test_import_legacy_note_results_package(tmp_path, monkeypatch):
    """旧格式包（note_results/ 而非 video/）走兼容路径"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "l")])
    zip_path = tgt / "pkg.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.write(db, "video_note.db")
        zf.writestr("note_results/old.md", "# old")
    restore_from_local_file(zip_path)
    assert (tgt / "notes" / "old.md").read_text(encoding="utf-8") == "# old"


def test_import_corrupt_zip_raises(tmp_path, monkeypatch):
    """非 zip 文件 → 抛'已损坏'"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    zip_path = tgt / "bad.zip"
    zip_path.write_bytes(b"not a zip file")
    with pytest.raises(Exception, match="已损坏"):
        restore_from_local_file(zip_path)


def test_zip_slip_not_written_outside_target(tmp_path, monkeypatch):
    """恶意 arcname 含 '../' 不应写出 restore 目录之外

    CPython 的 zipfile.extractall 自 3.6.2 起清洗 '..'（路径穿越防护），
    canary 被归一化进 restore_temp_dir 内、随后被 finally 清理。
    本测试作为回归守卫：若将来换成不清洗的手动解压，canary 会逃逸到
    tgt/temp/__outside_canary__（restore 父级，不被 finally 清理）→ 断言失败。
    """
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    db = tgt / "_src" / "video_note.db"
    _seed_db(db, [(1, "z")])
    zip_path = tgt / "pkg.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.write(db, "video_note.db")
        zf.writestr("../__outside_canary__", "PWNED")
    restore_from_local_file(zip_path)
    # canary 不应出现在 restore 目录之外（restore_temp_dir = tgt/temp/restore）
    assert not (tgt / "temp" / "__outside_canary__").exists(), \
        "zip-slip：canary 逃逸到 restore 目录之外"


def test_import_twice_idempotent(tmp_path, monkeypatch):
    """同一包连续导入两次，最终 DB/video 状态一致"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    (webdav_backup.VIDEO_DIR / "a").mkdir()
    (webdav_backup.VIDEO_DIR / "a" / "m.md").write_text("# m")
    _seed_db(webdav_backup.DB_FILE, [(1, "a"), (2, "b")])
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    restore_from_local_file(zip_path)
    snap1 = (tgt / "video_note.db").read_bytes(), sorted(p.relative_to(tgt) for p in (tgt / "video").rglob("*") if p.is_file())
    restore_from_local_file(zip_path)
    snap2 = (tgt / "video_note.db").read_bytes(), sorted(p.relative_to(tgt) for p in (tgt / "video").rglob("*") if p.is_file())
    assert snap1 == snap2


def test_db_schema_not_upgraded_on_import(tmp_path, monkeypatch):
    """【已知】import 仅文件级覆盖，不自动跑 schema 迁移（需重启 app）"""
    src, tgt = tmp_path / "src", tmp_path / "tgt"
    _point(monkeypatch, src)
    # 源 DB 用'旧 schema'：video_tasks 只有 legacy_col 列
    con = sqlite3.connect(webdav_backup.DB_FILE)
    con.execute("CREATE TABLE video_tasks (id INTEGER PRIMARY KEY, legacy_col TEXT)")
    con.execute("INSERT INTO video_tasks (id, legacy_col) VALUES (1, 'old')")
    con.commit()
    con.close()
    (webdav_backup.VIDEO_DIR / "a").mkdir()
    (webdav_backup.VIDEO_DIR / "a" / "f.md").write_text("x")
    _stub_export(monkeypatch)
    zip_path = _export_local()

    _point(monkeypatch, tgt)
    restore_from_local_file(zip_path)
    con = sqlite3.connect(tgt / "video_note.db")
    cols = [r[1] for r in con.execute("PRAGMA table_info(video_tasks)")]
    con.close()
    assert cols == ["id", "legacy_col"], "导入不应升级 schema（需重启跑迁移）"


def test_restore_upload_route_not_shadowed(tmp_path, monkeypatch):
    """回归：POST /restore/upload 必须命中 restore_from_upload，而非被 /restore/{backup_name} shadow

    历史 bug：path 参数路由先注册，把 /restore/upload 吃成 backup_name='upload'，
    导致上传导入端点不可达、永远返回 '请先配置 WebDAV 连接'。
    """
    from types import SimpleNamespace
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers import webdav as webdav_router
    from app.auth.dependencies import get_current_user, require_admin

    _fake_admin = SimpleNamespace(id=1, username="admin", role="admin")
    app = FastAPI()
    app.include_router(webdav_router.router, prefix="/api/webdav")
    app.dependency_overrides[get_current_user] = lambda: _fake_admin
    app.dependency_overrides[require_admin] = lambda: _fake_admin
    client = TestClient(app)

    # 上传一个非 zip 文件：restore_from_upload 应返回'只支持 .zip'，而非 WebDAV 守卫文案
    resp = client.post(
        "/api/webdav/restore/upload",
        files={"file": ("not_a_zip.txt", b"hello", "application/octet-stream")},
    )
    body = resp.json()
    assert body["code"] != 0, "应被拒绝"
    assert ".zip" in body["msg"], f"应命中 restore_from_upload（.zip 校验），实际: {body['msg']}"
    assert "WebDAV" not in body["msg"], "不应被 /restore/{{backup_name}} shadow 到 WebDAV 守卫"
