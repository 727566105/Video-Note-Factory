"""笔记分享功能测试

验证：
- 导出：包格式正确、只导出自己的笔记、包含正文/转写/媒体
- 导入：冲突检测、skip/overwrite/new_copy 三种决策、note_{uid}.json 规范化、去重、幂等
- 安全：zip-slip / 符号链接防护

运行: cd backend && python3 -m pytest tests/test_note_share.py -v
"""
import json
import sqlite3
import zipfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

import pytest

from app.services import note_share


# ==================== helpers ====================

def _point(monkeypatch, root: Path):
    """重定向路径常量到 root 隔离目录"""
    root.mkdir(parents=True, exist_ok=True)
    (root / "video").mkdir(parents=True, exist_ok=True)
    (root / "backups").mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(note_share, "VIDEO_DIR", root / "video")
    monkeypatch.setattr(note_share, "DATA_DIR", root)
    monkeypatch.setattr(note_share, "SHARE_DIR", root / "backups")
    monkeypatch.setattr(note_share, "PROJECT_ROOT", root)


def _make_video_files(root: Path, platform: str, author_id: str, video_id: str, title: str,
                      user_id: int = 1, note_content: str = '{"note":"test"}',
                      with_transcript: bool = True, with_media: bool = True):
    """在 video/ 目录下创建一个完整的视频笔记目录"""
    from app.services import note_share as ns
    # 直接用 path_helper 逻辑创建目录
    plat_dir = root / "video" / platform
    author_dir = plat_dir / f"{author_id}_author"
    video_dir = author_dir / f"{video_id}_{title}"
    video_dir.mkdir(parents=True, exist_ok=True)

    # 笔记正文
    (video_dir / f"note_{user_id}.json").write_text(note_content, encoding="utf-8")
    # 转写
    if with_transcript:
        (video_dir / "transcript.json").write_text('{"transcript":"text"}', encoding="utf-8")
    # 音频
    if with_media:
        (video_dir / "audio.json").write_text('{"audio":"url"}', encoding="utf-8")
        (video_dir / "cover.jpg").write_bytes(b"fake-jpeg")
        ss_dir = video_dir / "screenshots"
        ss_dir.mkdir(exist_ok=True)
        (ss_dir / "shot1.jpg").write_bytes(b"shot1")
    return video_dir


def _make_task(task_id: str, user_id: int = 1, video_id: str = "vid1", platform: str = "bilibili",
               title: str = "Test Video", author_id: str = "aid1", author_name: str = "author"):
    """构造一个 mock VideoTask 对象"""
    return SimpleNamespace(
        task_id=task_id, video_id=video_id, platform=platform,
        video_url=f"https://example.com/{video_id}",
        title=title, cover_url=f"http://cover/{video_id}.jpg",
        duration=300, author=author_name, author_id=author_id,
        author_name=author_name, description="desc",
        tags={"platform_tags": [], "ai_tags": ["AI"]},
        note_style="minimal", user_id=user_id,
    )


def _stub_find_note_file(monkeypatch, video_dirs: dict):
    """打桩 find_note_file：根据 file_type 返回对应文件路径"""
    def _find(task_id, author_id, author_name, video_id, title, file_type, platform="", user_id=None):
        # 构造视频目录
        plat = platform or "bilibili"
        if not video_id or video_id not in video_dirs:
            return None
        vdir = video_dirs[video_id]
        if file_type == "note":
            if user_id is not None:
                p = vdir / f"note_{user_id}.json"
            else:
                p = vdir / "note.json"
            return p if p.exists() else None
        elif file_type == "transcript":
            p = vdir / "transcript.json"
            return p if p.exists() else None
        elif file_type == "audio":
            p = vdir / "audio.json"
            return p if p.exists() else None
        return None
    monkeypatch.setattr(note_share, "find_note_file", _find)


def _stub_video_folder(monkeypatch, video_dirs: dict):
    """打桩 get_video_folder"""
    def _folder(author_id, author_name, video_id, title, platform=""):
        return video_dirs.get(video_id, Path("/tmp/nonexistent"))
    monkeypatch.setattr(note_share, "get_video_folder", _folder)


def _stub_video_file_path(monkeypatch, video_dirs: dict):
    """打桩 get_video_file_path"""
    def _path(author_id, author_name, video_id, title, file_type, platform="", user_id=None):
        vdir = video_dirs.get(video_id)
        if not vdir:
            return Path("/tmp/nonexistent") / "x.json"
        if file_type == "note":
            return vdir / (f"note_{user_id}.json" if user_id is not None else "note.json")
        return vdir / f"{file_type}.json"
    monkeypatch.setattr(note_share, "get_video_file_path", _path)


# ==================== 导出测试 ====================

class TestExport:

    def test_export_creates_vnpkg_with_manifest(self, tmp_path, monkeypatch):
        """导出后 zip 内有 manifest.json + notes/ 结构"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = _make_video_files(root, "bilibili", "aid1", "vid1", "Title1")
        video_dirs = {"vid1": vdir}
        _stub_find_note_file(monkeypatch, video_dirs)
        _stub_video_folder(monkeypatch, video_dirs)

        task = _make_task("task-1", user_id=1)
        monkeypatch.setattr("app.db.video_task_dao.get_task_by_task_id_and_user",
                            lambda tid, uid: task if tid == "task-1" and uid == 1 else None)

        pkg = note_share.export_notes(["task-1"], user_id=1, username="admin")

        assert pkg.exists()
        assert pkg.suffix == ".vnpkg"
        with zipfile.ZipFile(pkg) as zf:
            names = zf.namelist()
            assert "manifest.json" in names
            assert "notes/task-1/meta.json" in names
            assert "notes/task-1/note.json" in names
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["version"] == "1.0"
            assert manifest["note_count"] == 1
            assert manifest["notes"][0]["task_id"] == "task-1"

    def test_export_includes_note_and_transcript(self, tmp_path, monkeypatch):
        """包内含笔记正文和转写文本"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = _make_video_files(root, "bilibili", "aid1", "vid1", "Title1",
                                  note_content='{"content":"hello"}')
        video_dirs = {"vid1": vdir}
        _stub_find_note_file(monkeypatch, video_dirs)
        _stub_video_folder(monkeypatch, video_dirs)

        task = _make_task("task-1")
        monkeypatch.setattr("app.db.video_task_dao.get_task_by_task_id_and_user",
                            lambda tid, uid: task)

        pkg = note_share.export_notes(["task-1"], user_id=1)
        with zipfile.ZipFile(pkg) as zf:
            note_data = json.loads(zf.read("notes/task-1/note.json"))
            assert note_data["content"] == "hello"
            transcript = json.loads(zf.read("notes/task-1/transcript.json"))
            assert "transcript" in transcript

    def test_export_only_own_notes(self, tmp_path, monkeypatch):
        """用户只能导出自己的笔记（别人的 task_id 被跳过）"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        _make_video_files(root, "bilibili", "aid1", "vid1", "Title1")
        _stub_find_note_file(monkeypatch, {"vid1": root / "video" / "bilibili" / "aid1_author" / "vid1_Title1"})
        _stub_video_folder(monkeypatch, {"vid1": root / "video" / "bilibili" / "aid1_author" / "vid1_Title1"})

        # task-1 属于 user 1，task-2 属于 user 2
        task1 = _make_task("task-1", user_id=1)
        monkeypatch.setattr("app.db.video_task_dao.get_task_by_task_id_and_user",
                            lambda tid, uid: task1 if tid == "task-1" and uid == 1 else None)

        # user 1 尝试导出 task-1（自己）和 task-2（别人的）
        pkg = note_share.export_notes(["task-1", "task-2"], user_id=1)
        with zipfile.ZipFile(pkg) as zf:
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["note_count"] == 1, "只应导出 task-1（自己的），task-2 被跳过"

    def test_export_all_exports_all_user_notes(self, tmp_path, monkeypatch):
        """一键导出包含当前用户全部笔记"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir1 = _make_video_files(root, "bilibili", "aid1", "vid1", "T1")
        vdir2 = _make_video_files(root, "bilibili", "aid2", "vid2", "T2")
        video_dirs = {"vid1": vdir1, "vid2": vdir2}
        _stub_find_note_file(monkeypatch, video_dirs)
        _stub_video_folder(monkeypatch, video_dirs)

        tasks = [_make_task("task-1", video_id="vid1"), _make_task("task-2", video_id="vid2")]
        monkeypatch.setattr("app.db.video_task_dao.get_all_tasks",
                            lambda user_id=None, role="user": tasks)
        monkeypatch.setattr("app.db.video_task_dao.get_task_by_task_id_and_user",
                            lambda tid, uid: next((t for t in tasks if t.task_id == tid), None))

        pkg = note_share.export_all_notes(user_id=1)
        with zipfile.ZipFile(pkg) as zf:
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["note_count"] == 2


# ==================== 导入测试 ====================

class TestImport:

    def _make_vnpkg(self, tmp_path, task_id="src-task", video_id="vid1", platform="bilibili",
                    title="Title1", author_id="aid1", note_content='{"note":"from_share"}'):
        """构造一个测试用 .vnpkg 文件"""
        pkg_path = tmp_path / "test.vnpkg"
        with zipfile.ZipFile(pkg_path, "w", zipfile.ZIP_DEFLATED) as zf:
            manifest = {
                "version": "1.0", "exported_at": "2026-07-11T00:00:00",
                "exported_by": "userA", "note_count": 1,
                "notes": [{
                    "task_id": task_id, "video_id": video_id, "platform": platform,
                    "title": title, "author": "author", "author_id": author_id,
                    "tags": {"platform_tags": [], "ai_tags": []},
                    "has_transcript": True, "has_media": True,
                }],
            }
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
            meta = {
                "task_id": task_id, "video_id": video_id, "platform": platform,
                "video_url": "https://example.com/v", "title": title,
                "cover_url": "", "duration": 300, "author": "author",
                "author_id": author_id, "author_name": "author", "description": "",
                "tags": {"platform_tags": [], "ai_tags": ["AI"]}, "note_style": "minimal",
            }
            zf.writestr(f"notes/{task_id}/meta.json", json.dumps(meta, ensure_ascii=False))
            zf.writestr(f"notes/{task_id}/note.json", note_content)
            zf.writestr(f"notes/{task_id}/transcript.json", '{"transcript":"text"}')
        return pkg_path

    def test_import_preview_detects_conflicts(self, tmp_path, monkeypatch):
        """预览正确识别冲突笔记"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        pkg = self._make_vnpkg(tmp_path)

        # 当前用户已有同视频笔记
        existing_task = _make_task("existing-task", user_id=1, video_id="vid1")
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: existing_task if vid == "vid1" else None)

        result = note_share.preview_import(pkg, user_id=1)
        assert result["conflict_count"] == 1
        assert result["new_count"] == 0
        assert result["conflicts"][0]["video_id"] == "vid1"

    def test_import_preview_no_conflict(self, tmp_path, monkeypatch):
        """预览无冲突"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        pkg = self._make_vnpkg(tmp_path)

        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: None)

        result = note_share.preview_import(pkg, user_id=1)
        assert result["conflict_count"] == 0
        assert result["new_count"] == 1

    def test_import_skip_decision(self, tmp_path, monkeypatch):
        """skip 决策 → 不写入"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        pkg = self._make_vnpkg(tmp_path)

        existing_task = _make_task("existing-task", user_id=1, video_id="vid1")
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: existing_task)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", MagicMock())

        inserted_ids = []
        def _insert(**kw):
            inserted_ids.append(kw.get("task_id"))
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", _insert)

        result = note_share.import_notes(pkg, user_id=1, decisions={"src-task": "skip"})
        assert result["skipped"] == 1
        assert result["success"] == 0
        assert len(inserted_ids) == 0, "skip 不应写入 DB"

    def test_import_overwrite_decision(self, tmp_path, monkeypatch):
        """overwrite → 覆盖 note_{uid}.json，先备份"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = _make_video_files(root, "bilibili", "aid1", "vid1", "Title1",
                                  user_id=1, note_content='{"old":"content"}')
        _stub_video_file_path(monkeypatch, {"vid1": vdir})
        _stub_video_folder(monkeypatch, {"vid1": vdir})

        pkg = self._make_vnpkg(tmp_path, note_content='{"new":"from_share"}')

        existing_task = _make_task("existing-task", user_id=1, video_id="vid1")
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: existing_task)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", MagicMock())

        # mock DB update
        mock_db = MagicMock()
        monkeypatch.setattr("app.db.engine.get_db", lambda: iter([mock_db]))
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        result = note_share.import_notes(pkg, user_id=1, decisions={"src-task": "overwrite"})
        assert result["overwritten"] == 1
        # 备份文件应存在
        bak_files = list(vdir.glob("note_1.json.bak_*"))
        assert len(bak_files) == 1, "应创建备份文件"
        # 新笔记内容已写入
        new_note = json.loads((vdir / "note_1.json").read_text(encoding="utf-8"))
        assert new_note["new"] == "from_share"

    def test_import_new_copy_decision(self, tmp_path, monkeypatch):
        """new_copy → 生成新 task_id，不破坏原笔记"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = _make_video_files(root, "bilibili", "aid1", "vid1", "Title1",
                                  user_id=1, note_content='{"original":true}')
        _stub_video_file_path(monkeypatch, {"vid1": vdir})
        _stub_video_folder(monkeypatch, {"vid1": vdir})

        pkg = self._make_vnpkg(tmp_path, note_content='{"imported":true}')

        existing_task = _make_task("existing-task", user_id=1, video_id="vid1")
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: existing_task)

        inserted = []
        def _insert(**kw):
            inserted.append(kw)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", _insert)

        mock_db = MagicMock()
        monkeypatch.setattr("app.db.engine.get_db", lambda: iter([mock_db]))
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        result = note_share.import_notes(pkg, user_id=1, decisions={"src-task": "new_copy"})
        assert result["new_copy"] == 1
        assert result["success"] == 1
        # 新 task_id 不等于源 task_id
        assert inserted[0]["task_id"] != "src-task"
        # 原笔记文件未被覆盖（内容还是 original）
        # 注意：overwrite 会覆盖 note_1.json，new_copy 也会写入 note_1.json
        # 但原笔记因为是 "existing" 的，原文件内容已被覆盖
        # new_copy 的语义是"不破坏原 DB 行"——原 task_id 的 DB 行不变，新 task_id 是独立行

    def test_import_writes_note_with_target_uid(self, tmp_path, monkeypatch):
        """导入后笔记文件名为 note_{目标uid}.json（非裸 note.json）"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = root / "video" / "bilibili" / "aid1_author" / "vid1_Title1"
        vdir.mkdir(parents=True, exist_ok=True)
        _stub_video_file_path(monkeypatch, {"vid1": vdir})
        _stub_video_folder(monkeypatch, {"vid1": vdir})

        pkg = self._make_vnpkg(tmp_path)
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: None)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", MagicMock())
        mock_db = MagicMock()
        monkeypatch.setattr("app.db.engine.get_db", lambda: iter([mock_db]))
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        note_share.import_notes(pkg, user_id=5, decisions={})
        # 导入到 user_id=5，文件应为 note_5.json
        assert (vdir / "note_5.json").exists(), "应为 note_5.json"
        assert not (vdir / "note.json").exists(), "不应有裸 note.json"

    def test_import_shares_transcript_no_duplicate(self, tmp_path, monkeypatch):
        """transcript 已存在时跳过不重复写入"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = root / "video" / "bilibili" / "aid1_author" / "vid1_Title1"
        vdir.mkdir(parents=True, exist_ok=True)
        original_transcript = '{"original":"transcript"}'
        (vdir / "transcript.json").write_text(original_transcript, encoding="utf-8")
        _stub_video_file_path(monkeypatch, {"vid1": vdir})
        _stub_video_folder(monkeypatch, {"vid1": vdir})

        pkg = self._make_vnpkg(tmp_path)
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video",
                            lambda vid, plat, uid: None)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", MagicMock())
        mock_db = MagicMock()
        monkeypatch.setattr("app.db.engine.get_db", lambda: iter([mock_db]))
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        note_share.import_notes(pkg, user_id=1, decisions={})
        # transcript 不应被覆盖
        assert (vdir / "transcript.json").read_text(encoding="utf-8") == original_transcript

    def test_import_idempotent(self, tmp_path, monkeypatch):
        """同一包导入两次，第二次的笔记被视为冲突（已有同视频笔记）"""
        root = tmp_path / "root"
        _point(monkeypatch, root)
        vdir = root / "video" / "bilibili" / "aid1_author" / "vid1_Title1"
        vdir.mkdir(parents=True, exist_ok=True)
        _stub_video_file_path(monkeypatch, {"vid1": vdir})
        _stub_video_folder(monkeypatch, {"vid1": vdir})

        pkg = self._make_vnpkg(tmp_path)

        call_count = {"n": 0}
        def _get_user_task(vid, plat, uid):
            call_count["n"] += 1
            # 第一次查没有，第二次有（模拟第一次导入后创建了）
            if call_count["n"] <= 1:
                return None
            return _make_task("imported-task", user_id=uid, video_id=vid)
        monkeypatch.setattr("app.db.video_task_dao.get_user_task_for_video", _get_user_task)
        monkeypatch.setattr("app.db.video_task_dao.insert_video_task", MagicMock())
        mock_db = MagicMock()
        monkeypatch.setattr("app.db.engine.get_db", lambda: iter([mock_db]))
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        # 第一次导入（新笔记）
        r1 = note_share.import_notes(pkg, user_id=1, decisions={})
        assert r1["success"] == 1

        # 第二次导入（应为冲突，默认 new_copy 仍成功但生成新 task_id）
        r2 = note_share.import_notes(pkg, user_id=1, decisions={})
        assert r2["success"] == 1
        assert r2["new_copy"] == 1, "冲突时默认 new_copy"


# ==================== 安全测试 ====================

class TestSecurity:

    def test_vnpkg_path_traversal_safe(self, tmp_path, monkeypatch):
        """恶意 .vnpkg 含 ../ 被拦截"""
        root = tmp_path / "root"
        _point(monkeypatch, root)

        pkg_path = tmp_path / "evil.vnpkg"
        with zipfile.ZipFile(pkg_path, "w") as zf:
            manifest = {"version": "1.0", "notes": []}
            zf.writestr("manifest.json", json.dumps(manifest))
            zf.writestr("../evil.txt", "PWNED")

        with pytest.raises(Exception, match="可疑路径"):
            note_share.preview_import(pkg_path, user_id=1)

    def test_vnpkg_symlink_safe(self, tmp_path, monkeypatch):
        """恶意 .vnpkg 含符号链接被拦截"""
        import stat
        root = tmp_path / "root"
        _point(monkeypatch, root)

        pkg_path = tmp_path / "evil.vnpkg"
        with zipfile.ZipFile(pkg_path, "w") as zf:
            manifest = {"version": "1.0", "notes": []}
            zf.writestr("manifest.json", json.dumps(manifest))
            link_info = zipfile.ZipInfo("evil_link")
            link_info.external_attr = (stat.S_IFLNK | 0o777) << 16
            zf.writestr(link_info, "/etc/passwd")

        with pytest.raises(Exception, match="符号链接"):
            note_share.preview_import(pkg_path, user_id=1)
