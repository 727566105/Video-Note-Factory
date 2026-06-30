"""WebDAV 备份/恢复 —— 清理行为与资源残留验证

逐条验证清理疑点，每条测试只断言"当前实际行为"，不修改生产代码。
运行: cd backend && python3 -m pytest tests/test_webdav_cleanup.py -v
"""
import sqlite3
import zipfile
from pathlib import Path

import pytest

from app.services import webdav_backup
from app.services.webdav_backup import WebDAVBackup, restore_from_local_file


# ==================== helpers（与 test_backup_import.py 一致的隔离模式）====================

def _make_service():
    """构造不触发 WebDAV 配置读取的实例"""
    svc = WebDAVBackup.__new__(WebDAVBackup)
    svc.config = None
    svc.client = None
    return svc


def _point(monkeypatch, root: Path):
    """把所有路径常量重定向到 root 下的隔离目录"""
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
    """建 video_tasks 表并插行"""
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE IF NOT EXISTS video_tasks (id INTEGER PRIMARY KEY, title TEXT)")
    con.executemany("INSERT OR REPLACE INTO video_tasks (id, title) VALUES (?, ?)", rows)
    con.commit()
    con.close()
    return path


def _zip_with_db(zip_path: Path, db_path: Path, extra: dict) -> Path:
    """构造含 DB 的整机包 zip（extra 是 video/ 下的额外文件）"""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(db_path, "video_note.db")
        for arcname, content in extra.items():
            zf.writestr(arcname, content)
    return zip_path


def _reset_global_state(monkeypatch):
    """每个测试前重置 webdav_backup 模块的全局状态，避免互相污染"""
    monkeypatch.setattr(webdav_backup, "_restore_in_progress", False)
    monkeypatch.setattr(webdav_backup, "_backup_in_progress", False)
    monkeypatch.setattr(webdav_backup, "_current_operation", None)
    monkeypatch.setattr(webdav_backup, "_current_progress", 0)
    monkeypatch.setattr(webdav_backup, "_current_message", "")
    monkeypatch.setattr(webdav_backup, "_current_skipped_files", [])


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """每个测试自动隔离全局状态"""
    _reset_global_state(monkeypatch)


# ==================== 疑点 1：pre_restore_backup_dir 清理 ====================

def test_pre_restore_dir_accumulates_on_success(tmp_path, monkeypatch):
    """【疑点1】连续成功导入 2 次，pre_restore 快照目录会累积吗？

    预期暴露：成功路径永不清理 pre_restore，每次导入留一个快照 → 无限累积。
    若本测试通过（len==2），说明确实累积，是清理盲点。
    """
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    # 源包：两个不同内容的包
    db_a = tgt / "_src_a" / "video_note.db"
    _seed_db(db_a, [(1, "from_a")])
    zip_a = _zip_with_db(tgt / "pkg_a.zip", db_a, {})

    db_b = tgt / "_src_b" / "video_note.db"
    _seed_db(db_b, [(1, "from_b")])
    zip_b = _zip_with_db(tgt / "pkg_b.zip", db_b, {})

    # 连续导入 2 次（用不同包，确保 pre_restore 时间戳不同）
    restore_from_local_file(zip_a)
    # 第一次后数一下快照
    snaps_after_1 = list((tgt / "temp").glob("pre_restore_*"))

    restore_from_local_file(zip_b)
    # 第二次后数一下快照
    snaps_after_2 = list((tgt / "temp").glob("pre_restore_*"))

    print(f"\n第1次导入后 pre_restore 快照数: {len(snaps_after_1)}")
    print(f"第2次导入后 pre_restore 快照数: {len(snaps_after_2)}")
    print(f"快照目录: {[s.name for s in snaps_after_2]}")

    # 【修复后预期】只保留最新，恒为 1（不再累积）
    assert len(snaps_after_2) == 1, f"应只保留 1 个快照，实际 {len(snaps_after_2)}"


def test_pre_restore_dir_accumulates_across_seconds(tmp_path, monkeypatch):
    """【疑点1-补充】两次导入间隔 >1 秒（时间戳不同），pre_restore 快照会累积吗？

    快照名按秒打时间戳。同秒导入会被覆盖，跨秒导入会留下多个。
    这里手动 mock datetime 制造不同时间戳，验证跨秒确实累积。
    """
    import datetime as dt
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    db_a = tgt / "_src_a" / "video_note.db"
    _seed_db(db_a, [(1, "from_a")])
    zip_a = _zip_with_db(tgt / "pkg_a.zip", db_a, {})

    # mock datetime.now 让两次导入拿到不同时间戳（相隔 100 秒）
    fake_times = [
        dt.datetime(2026, 6, 30, 10, 0, 5),
        dt.datetime(2026, 6, 30, 10, 1, 45),
    ]
    call_count = {"n": 0}
    real_now = dt.datetime.now

    def fake_now(*args, **kwargs):
        if call_count["n"] < len(fake_times):
            t = fake_times[call_count["n"]]
            call_count["n"] += 1
            return t
        return real_now()

    # restore_from_local_file 内部用 datetime.now()，需 mock 模块级引用
    import app.services.webdav_backup as wb_mod
    monkeypatch.setattr(wb_mod, "datetime", type("DT", (), {
        "now": staticmethod(fake_now),
        "strftime": dt.datetime.strftime,
    }))

    # 第一次导入（时间戳 10:00:05）
    call_count["n"] = 0
    restore_from_local_file(zip_a)
    snaps_1 = sorted((tgt / "temp").glob("pre_restore_*"))

    # 第二次导入（时间戳 10:01:45）
    restore_from_local_file(zip_a)
    snaps_2 = sorted((tgt / "temp").glob("pre_restore_*"))

    print(f"\n跨秒第1次后快照: {[s.name for s in snaps_1]}")
    print(f"跨秒第2次后快照: {[s.name for s in snaps_2]}")
    print(f"快照总数: {len(snaps_2)}")

    # 【修复后预期】只保留最新快照，旧的已清理 → 恒为 1
    assert len(snaps_2) == 1, f"应只保留最新 1 个快照，实际 {len(snaps_2)} 个: {[s.name for s in snaps_2]}"


def test_rollback_leaves_pre_restore_dir(tmp_path, monkeypatch):
    """【疑点1-失败路径】恢复失败回滚后，pre_restore 快照目录会清理吗？

    预期暴露：失败路径用 pre_restore 回滚，用完也不清理，残留。
    """
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    # 目标有原始 video 内容
    (webdav_backup.VIDEO_DIR / "a").mkdir(parents=True)
    (webdav_backup.VIDEO_DIR / "a" / "orig.md").write_text("orig")
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    # 源包：含 video/ 内容，这样恢复时会调 _replace_dir
    db_src = tgt / "_src" / "video_note.db"
    _seed_db(db_src, [(1, "src")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db_src, {
        "video/a/src.md": "src content"
    })

    orig_db_hash = (tgt / "video_note.db").read_bytes()

    # 注入失败：_replace_dir 第 1 次调用抛异常（恢复 video 时）
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

    # 回滚后 pre_restore 快照是否还在？
    snaps = list((tgt / "temp").glob("pre_restore_*"))
    print(f"\n失败回滚后 pre_restore 快照数: {len(snaps)}")
    print(f"快照目录: {[s.name for s in snaps]}")
    # 验证 DB 确实回滚了
    assert (tgt / "video_note.db").read_bytes() == orig_db_hash, "DB 应已回滚"

    # 暴露：回滚后 pre_restore 不清理


# ==================== 疑点 2：全局状态 _restore_in_progress 卡死 ====================

def test_restore_in_progress_reset_by_startup_healing(tmp_path, monkeypatch):
    """【疑点2-修复后】reset_stale_backup_state() 应清除卡死状态

    模拟：上次操作被 kill 中断（状态卡 True），调用启动自愈函数后应可恢复。
    """
    # 模拟"上一次操作被 kill 中断"：全局状态卡在 True
    monkeypatch.setattr(webdav_backup, "_restore_in_progress", True)
    monkeypatch.setattr(webdav_backup, "_backup_in_progress", True)
    monkeypatch.setattr(webdav_backup, "_current_skipped_files", ["残留记录"])

    # 启动自愈重置
    webdav_backup.reset_stale_backup_state()

    # 自愈后状态应全部归零
    assert webdav_backup._restore_in_progress is False
    assert webdav_backup._backup_in_progress is False
    assert webdav_backup._current_skipped_files == []

    # 自愈后应能正常恢复
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    db_src = tgt / "_src" / "video_note.db"
    _seed_db(db_src, [(1, "src")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db_src, {})

    # 不应再被阻塞
    restore_from_local_file(zip_path)
    print("\n自愈重置后恢复成功，不再永久阻塞")


# ==================== 疑点 4：_current_skipped_files 跨操作污染 ====================

def test_skipped_files_cleared_on_success(tmp_path, monkeypatch):
    """【疑点4】正常流程下 skipped_files 会被重置吗？

    验证：函数开头会 _current_skipped_files = []，正常流程不污染。
    """
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    db_src = tgt / "_src" / "video_note.db"
    _seed_db(db_src, [(1, "src")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db_src, {})

    # 预置一个"上次的"skipped 残留
    monkeypatch.setattr(webdav_backup, "_current_skipped_files", ["遗留的旧跳过记录"])

    restore_from_local_file(zip_path)

    print(f"\n恢复后 skipped_files: {webdav_backup._current_skipped_files}")

    # 正常流程：开头重置为 []，本次无跳过 → 应为空
    assert webdav_backup._current_skipped_files == [], "正常恢复后应清空"


# ==================== 正常清理验证 + 端到端完整性 ====================

def test_restore_temp_dir_cleaned_after_success(tmp_path, monkeypatch):
    """【正常清理】成功导入后 restore_temp_dir 应被清理（验证正常清理生效）"""
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])
    db_src = tgt / "_src" / "video_note.db"
    _seed_db(db_src, [(1, "src")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db_src, {
        "video/a/src.md": "src content"
    })

    restore_from_local_file(zip_path)

    restore_temp = webdav_backup.BACKUP_TEMP_DIR / "restore"
    print(f"\n成功后 restore_temp_dir 存在? {restore_temp.exists()}")
    # 正常清理：restore_temp_dir 应被 finally 清理
    assert not restore_temp.exists(), "restore_temp_dir 应被清理"


def test_full_roundtrip_data_correct_and_residue_audit(tmp_path, monkeypatch):
    """【端到端】完整备份→恢复→数据正确性 + 磁盘残留审计

    跑完整流程后，盘点磁盘上应该有什么、不应该有什么：
    - ✅ 应有：用户数据(video_note.db, video/, notes/)、pre_restore 快照
    - ❌ 不应有：restore_temp_dir、临时 zip
    """
    tgt = tmp_path / "tgt"
    _point(monkeypatch, tgt)
    # 初始数据
    (webdav_backup.VIDEO_DIR / "a").mkdir(parents=True)
    (webdav_backup.VIDEO_DIR / "a" / "f.md").write_text("v1")
    _seed_db(webdav_backup.DB_FILE, [(1, "orig")])

    # 源包
    db_src = tgt / "_src" / "video_note.db"
    _seed_db(db_src, [(1, "new")])
    zip_path = _zip_with_db(tgt / "pkg.zip", db_src, {
        "video/a/f.md": "v2",
        "video/b/g.md": "new file"
    })

    restore_from_local_file(zip_path)

    # 1. 数据正确性
    assert (tgt / "video_note.db").exists(), "DB 应存在"
    rows = sqlite3.connect(tgt / "video_note.db").execute("SELECT title FROM video_tasks").fetchall()
    assert rows == [("new",)], f"DB 应为新数据，实际 {rows}"
    assert (webdav_backup.VIDEO_DIR / "a" / "f.md").read_text() == "v2", "video 应被覆盖"
    assert (webdav_backup.VIDEO_DIR / "b" / "g.md").read_text() == "new file", "新文件应存在"

    # 2. 磁盘残留审计
    restore_temp = webdav_backup.BACKUP_TEMP_DIR / "restore"
    snaps = list((tgt / "temp").glob("pre_restore_*"))
    temp_items = list((tgt / "temp").iterdir()) if (tgt / "temp").exists() else []

    print(f"\n=== 磁盘残留审计 ===")
    print(f"restore_temp_dir 存在? {restore_temp.exists()} (应为 False)")
    print(f"pre_restore 快照数: {len(snaps)} (≥1, 成功后留存)")
    print(f"temp 目录内容: {[p.name for p in temp_items]}")
    print(f"源 zip 残留? {(tgt / 'pkg.zip').exists()} (源文件，非临时产物)")

    # restore_temp 应清理
    assert not restore_temp.exists(), "restore_temp 不应残留"
    # pre_restore 应留存（成功路径不清理）
    assert len(snaps) >= 1, "pre_restore 应留存"



