"""多用户数据隔离 + 智能复用 API 单元测试

测试场景：
1. 物理删除：用户删除笔记后数据库记录消失，本地文件清理
2. 跨用户访问拒绝：403
3. 任务列表不含已删除任务
4. 笔记文件命名验证
"""
import json
import os
import pytest
from datetime import datetime, timedelta
from pathlib import Path
from fastapi.testclient import TestClient
from fastapi import FastAPI

# 检查数据库和 bcrypt 兼容性
_db_ok = False
try:
    from app.db.init_db import init_db
    init_db()
    from app.db.user_dao import hash_password
    hash_password("test")
    _db_ok = True
except Exception:
    pass


@pytest.fixture
def app():
    from app.routers import auth, note, config
    _app = FastAPI()
    _app.include_router(auth.router, prefix="/api/auth")
    _app.include_router(note.router, prefix="/api")
    _app.include_router(config.router, prefix="/api")
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


def _get_token(client: TestClient, username: str, password: str):
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    data = resp.json()
    if data.get("code") != 0:
        return None
    return data.get("data", {}).get("token")


@pytest.fixture
def admin_token(client):
    return _get_token(client, "admin", "123456")


@pytest.fixture
def user_token(client):
    """获取测试用户 token，如不存在则创建"""
    token = _get_token(client, "testuser", "123456")
    if not token:
        try:
            from app.db.user_dao import create_user
            create_user("testuser", "123456", "user")
        except Exception:
            pass
        token = _get_token(client, "testuser", "123456")
    return token


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestHardDelete:
    """TC05: 物理删除测试"""

    def test_hard_delete_removes_record(self, client, admin_token):
        """删除笔记后，数据库记录被物理删除（get_task_by_task_id 返回 None）"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        # 先获取一个任务
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有可删除的测试数据")
        task_id = tasks[0]["task_id"]

        # 执行删除
        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

        # 验证数据库中记录已被物理删除
        from app.db.video_task_dao import get_task_by_task_id
        task = get_task_by_task_id(task_id)
        assert task is None, "任务记录应已被物理删除"

    def test_deleted_task_not_in_list(self, client, admin_token):
        """已删除的任务不应出现在任务列表中"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.get("/api/tasks?limit=100", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0
        tasks = resp.json()["data"]["tasks"]
        # 列表中所有任务都应能在数据库中查到（物理删除的不在表内）
        from app.db.video_task_dao import get_task_by_task_id
        for task in tasks:
            db_task = get_task_by_task_id(task["task_id"])
            assert db_task is not None, f"任务 {task['task_id']} 在列表中但数据库查不到"

    def test_delete_other_user_task_denied(self, client, admin_token, user_token):
        """用户不能删除其他用户的任务"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        # 获取 admin 的任务
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        # testuser 尝试删除 admin 的任务
        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestCleanupTaskFiles:
    """物理删除时本地文件清理测试（含空作者目录清理）"""

    # 测试用的固定字段，避免污染真实数据
    _PLATFORM = "bilibili"
    _AUTHOR_ID = "TEST_CLEANUP_AUTH"
    _AUTHOR_NAME = "清理测试作者"
    _USER_ID = 1

    def _make_task(self, video_id, title, task_id):
        """造一条测试任务 + 本地笔记文件，返回 (task_id, video_dir)"""
        from app.db.video_task_dao import insert_video_task, update_task_metadata
        from app.utils.path_helper import (
            get_video_folder_name, get_author_folder_name, _get_platform_dir, VIDEO_DIR
        )
        insert_video_task(video_id, self._PLATFORM, task_id, "https://test.com",
                          user_id=self._USER_ID, author_id=self._AUTHOR_ID,
                          author_name=self._AUTHOR_NAME)
        # insert_video_task 不接受 title 参数，需单独更新
        update_task_metadata(task_id=task_id, title=title, user_id=self._USER_ID)
        # 造本地文件（路径必须和 _cleanup_task_files 计算的一致）
        platform_dir = _get_platform_dir(self._PLATFORM)
        author_folder = get_author_folder_name(self._AUTHOR_ID, self._AUTHOR_NAME, self._PLATFORM)
        video_folder = get_video_folder_name(video_id, title)
        video_dir = VIDEO_DIR / platform_dir / author_folder / video_folder
        video_dir.mkdir(parents=True, exist_ok=True)
        (video_dir / f"note_{self._USER_ID}.json").write_text('{"markdown":"# test"}')
        (video_dir / "status.json").write_text('{"status":"SUCCESS"}')
        (video_dir / "cover.jpg").write_text("fake cover")
        return task_id, video_dir

    def _author_dir(self):
        from app.utils.path_helper import (
            get_author_folder_name, _get_platform_dir, VIDEO_DIR
        )
        return VIDEO_DIR / _get_platform_dir(self._PLATFORM) / get_author_folder_name(
            self._AUTHOR_ID, self._AUTHOR_NAME, self._PLATFORM
        )

    def _cleanup_test_data(self):
        """清理测试残留（作者目录及以下全删 + 数据库记录）"""
        import shutil
        from app.db.video_task_dao import get_db
        from app.db.models.video_tasks import VideoTask
        author_dir = self._author_dir()
        if author_dir.exists():
            shutil.rmtree(author_dir, ignore_errors=True)
        db = next(get_db())
        try:
            db.query(VideoTask).filter(VideoTask.author_id == self._AUTHOR_ID).delete()
            db.commit()
        finally:
            db.close()

    def setup_method(self):
        """每个测试前确保环境干净"""
        self._cleanup_test_data()

    def teardown_method(self):
        """每个测试后清理"""
        self._cleanup_test_data()

    def test_single_video_cleanup_author_dir(self, client, admin_token):
        """删最后一条视频时，视频目录 + 空作者目录都应被清理"""
        if not admin_token:
            pytest.skip("admin 不可用")
        task_id, video_dir = self._make_task("CLEAN_SINGLE", "单视频测试", "cleanup-single-001")
        author_dir = self._author_dir()
        assert video_dir.exists(), "测试前视频目录应存在"
        assert author_dir.exists(), "测试前作者目录应存在"

        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

        assert not video_dir.exists(), "视频目录应被删除"
        assert not author_dir.exists(), "空作者目录应被清理"

    def test_multi_video_keep_author_dir(self, client, admin_token):
        """多视频作者删一个，作者目录应保留（其他视频还在）"""
        if not admin_token:
            pytest.skip("admin 不可用")
        _, video_dir1 = self._make_task("CLEAN_MULTI_1", "多视频1", "cleanup-multi-001")
        _, video_dir2 = self._make_task("CLEAN_MULTI_2", "多视频2", "cleanup-multi-002")
        author_dir = self._author_dir()

        # 删第一个
        resp = client.post("/api/delete_task",
                           json={"task_id": "cleanup-multi-001"},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

        assert not video_dir1.exists(), "被删的视频目录应消失"
        assert video_dir2.exists(), "未删的视频目录应保留"
        assert author_dir.exists(), "作者目录应保留（还有其他视频）"

    def test_ds_store_keeps_author_dir(self, client, admin_token):
        """作者目录只剩 .DS_Store 时不应被清理（隐藏文件算内容）"""
        if not admin_token:
            pytest.skip("admin 不可用")
        task_id, video_dir = self._make_task("CLEAN_DS", "DS测试", "cleanup-ds-001")
        author_dir = self._author_dir()
        # 预先放一个 .DS_Store
        (author_dir / ".DS_Store").write_text("fake ds store")

        resp = client.post("/api/delete_task",
                           json={"task_id": task_id},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0

        assert not video_dir.exists(), "视频目录应被删除"
        assert author_dir.exists(), "有 .DS_Store 的作者目录应保留"
        assert (author_dir / ".DS_Store").exists(), ".DS_Store 应保留"

    def test_concurrent_delete_same_author(self, client, admin_token):
        """并发删除同一作者的两个视频，最后作者目录应被清理"""
        if not admin_token:
            pytest.skip("admin 不可用")
        _, video_dir1 = self._make_task("CLEAN_CONC_1", "并发1", "cleanup-conc-001")
        _, video_dir2 = self._make_task("CLEAN_CONC_2", "并发2", "cleanup-conc-002")
        author_dir = self._author_dir()

        # 串行删两个（TestClient 不支持真并发，但能验证多次删除的累积效果）
        client.post("/api/delete_task",
                    json={"task_id": "cleanup-conc-001"},
                    headers={"Authorization": f"Bearer {admin_token}"})
        client.post("/api/delete_task",
                    json={"task_id": "cleanup-conc-002"},
                    headers={"Authorization": f"Bearer {admin_token}"})

        assert not video_dir1.exists() and not video_dir2.exists(), "两个视频目录都应删除"
        assert not author_dir.exists(), "空作者目录应被清理"

    def test_missing_video_dir_no_crash(self, client, admin_token):
        """视频目录不存在（已被手动删）时不应崩溃"""
        if not admin_token:
            pytest.skip("admin 不可用")
        # 只造数据库记录，不造本地文件
        from app.db.video_task_dao import insert_video_task
        insert_video_task("CLEAN_NODIR", self._PLATFORM, "cleanup-nodir-001", "https://test.com",
                          user_id=self._USER_ID, author_id=self._AUTHOR_ID,
                          author_name=self._AUTHOR_NAME)

        resp = client.post("/api/delete_task",
                           json={"task_id": "cleanup-nodir-001"},
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.json()["code"] == 0, "目录不存在时删除应成功（幂等）"

        from app.db.video_task_dao import get_task_by_task_id
        assert get_task_by_task_id("cleanup-nodir-001") is None, "数据库记录应已删除"


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestCrossUserAccess:
    """TC08: 跨用户访问拒绝"""

    def test_task_status_cross_user_denied(self, client, admin_token, user_token):
        """用户B访问用户A的 task_status 应返回 403"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        resp = client.get(f"/api/task_status/{task_id}",
                          headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    def test_quick_view_cross_user_denied(self, client, admin_token, user_token):
        """用户B快速查看用户A的笔记应返回 403"""
        if not admin_token or not user_token:
            pytest.skip("需要两个用户")
        resp = client.get("/api/tasks?limit=1", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        if not tasks:
            pytest.skip("没有测试数据")
        task_id = tasks[0]["task_id"]

        resp = client.get(f"/api/quick_view/{task_id}",
                          headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403


class TestNoteFileNaming:
    """TC09: 笔记文件命名验证"""

    def test_note_filename_with_user_id(self):
        """有 user_id 时生成 note_{user_id}.json"""
        from app.utils.path_helper import _note_filename
        assert _note_filename(1) == "note_1.json"
        assert _note_filename(2) == "note_2.json"
        assert _note_filename(999) == "note_999.json"

    def test_note_filename_without_user_id(self):
        """无 user_id 时回退到 note.json"""
        from app.utils.path_helper import _note_filename
        assert _note_filename(None) == "note.json"

    def test_get_video_file_path_note_with_user(self):
        """get_video_file_path 在 file_type='note' 时使用 user_id"""
        from app.utils.path_helper import get_video_file_path
        import tempfile
        # 使用临时目录避免实际创建
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "note", "bilibili", user_id=1)
        assert path.name == "note_1.json"

    def test_get_video_file_path_note_without_user(self):
        """get_video_file_path 在 file_type='note' 无 user_id 时使用 note.json"""
        from app.utils.path_helper import get_video_file_path
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "note", "bilibili")
        assert path.name == "note.json"

    def test_get_video_file_path_audio_unchanged(self):
        """非 note 类型的文件不受 user_id 影响"""
        from app.utils.path_helper import get_video_file_path
        path = get_video_file_path("author1", "test_author", "vid1", "test_title", "transcript", "bilibili", user_id=1)
        assert path.name == "transcript.json"


class TestDAOFunctions:
    """DAO 层函数验证"""

    def test_get_all_tasks_no_soft_deleted(self):
        """get_all_tasks 不应返回已物理删除的任务（物理删除后记录不在表内）"""
        from app.db.video_task_dao import get_all_tasks
        if not _db_ok:
            pytest.skip("数据库不可用")
        tasks = get_all_tasks(user_id=1, limit=100)
        # 所有返回的任务都应能在数据库中查到
        from app.db.video_task_dao import get_task_by_task_id
        for task in tasks:
            assert get_task_by_task_id(task.task_id) is not None, f"任务 {task.task_id} 在列表中但数据库查不到"

    def test_find_source_data_function_exists(self):
        """find_source_data 函数应可正常导入"""
        from app.db.video_task_dao import find_source_data
        assert callable(find_source_data)

    def test_find_matching_note_function_exists(self):
        """find_matching_note 函数应可正常导入"""
        from app.db.video_task_dao import find_matching_note
        assert callable(find_matching_note)

    def test_hard_delete_task_by_user_function_exists(self):
        """hard_delete_task_by_user 函数应可正常导入"""
        from app.db.video_task_dao import hard_delete_task_by_user
        assert callable(hard_delete_task_by_user)

    def test_get_user_task_for_video_function_exists(self):
        """get_user_task_for_video 函数应可正常导入"""
        from app.db.video_task_dao import get_user_task_for_video
        assert callable(get_user_task_for_video)


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestCrossUserReuse:
    """跨用户复用逻辑测试"""

    _PLATFORM = "bilibili"
    _AUTHOR_ID = "TEST_REUSE_AUTH"
    _AUTHOR_NAME = "复用测试作者"

    def _make_task_with_note(self, video_id, title, task_id, user_id, style="detailed"):
        """造一条带 note 文件的任务，返回 task_id"""
        from app.db.video_task_dao import insert_video_task, update_task_metadata
        from app.utils.path_helper import (
            get_video_folder_name, get_author_folder_name, _get_platform_dir, VIDEO_DIR
        )
        insert_video_task(video_id, self._PLATFORM, task_id, "https://test.com",
                          user_id=user_id, author_id=self._AUTHOR_ID,
                          author_name=self._AUTHOR_NAME, note_style=style)
        update_task_metadata(task_id=task_id, title=title, user_id=user_id)
        # 造 note_{user_id}.json
        platform_dir = _get_platform_dir(self._PLATFORM)
        author_folder = get_author_folder_name(self._AUTHOR_ID, self._AUTHOR_NAME, self._PLATFORM)
        video_folder = get_video_folder_name(video_id, title)
        video_dir = VIDEO_DIR / platform_dir / author_folder / video_folder
        video_dir.mkdir(parents=True, exist_ok=True)
        import json as _json
        (video_dir / f"note_{user_id}.json").write_text(
            _json.dumps({"markdown": f"# {title}", "content_type": "video",
                         "transcript": {}, "audio_meta": {}, "model_name": "test",
                         "style": style, "versions": []})
        )
        (video_dir / "cover.jpg").write_text("fake")
        (video_dir / "status.json").write_text('{"status":"SUCCESS"}')
        return task_id

    def _cleanup(self):
        import shutil
        from app.db.video_task_dao import get_db
        from app.db.models.video_tasks import VideoTask
        from app.utils.path_helper import (
            get_author_folder_name, _get_platform_dir, VIDEO_DIR
        )
        author_dir = VIDEO_DIR / _get_platform_dir(self._PLATFORM) / get_author_folder_name(
            self._AUTHOR_ID, self._AUTHOR_NAME, self._PLATFORM
        )
        if author_dir.exists():
            shutil.rmtree(author_dir, ignore_errors=True)
        db = next(get_db())
        try:
            db.query(VideoTask).filter(VideoTask.author_id == self._AUTHOR_ID).delete()
            db.commit()
        finally:
            db.close()

    def setup_method(self):
        self._cleanup()

    def teardown_method(self):
        self._cleanup()

    def test_clone_task_to_user_creates_new_task_id(self):
        """clone_task_to_user 应生成新 task_id（不等于原始 task_id）"""
        from app.db.video_task_dao import clone_task_to_user, get_task_by_task_id
        self._make_task_with_note("REUSE_CLONE", "克隆测试", "reuse-clone-src", user_id=2)
        cloned = clone_task_to_user("reuse-clone-src", 1, "REUSE_CLONE", self._PLATFORM)
        assert cloned.task_id != "reuse-clone-src", "新 task_id 不应等于原始 task_id"
        assert cloned.source_task_id == "reuse-clone-src", "source_task_id 应指向原始任务"
        assert cloned.user_id == 1
        # 原始任务仍在
        assert get_task_by_task_id("reuse-clone-src") is not None

    def test_clone_task_to_user_idempotent(self):
        """同一用户重复 clone 应返回同一条记录（幂等）"""
        from app.db.video_task_dao import clone_task_to_user
        self._make_task_with_note("REUSE_IDEM", "幂等测试", "reuse-idem-src", user_id=2)
        c1 = clone_task_to_user("reuse-idem-src", 1, "REUSE_IDEM", self._PLATFORM)
        c2 = clone_task_to_user("reuse-idem-src", 1, "REUSE_IDEM", self._PLATFORM)
        assert c1.task_id == c2.task_id, "重复 clone 应返回相同 task_id"

    def test_find_matching_note_cross_user(self):
        """find_matching_note 应能跨用户找到同风格笔记"""
        from app.db.video_task_dao import find_matching_note
        self._make_task_with_note("REUSE_MATCH", "匹配测试", "reuse-match-src", user_id=2, style="detailed")
        # 用户 1 查找（应找到用户 2 的任务）
        result = find_matching_note("REUSE_MATCH", self._PLATFORM, 1, "detailed")
        assert result is not None, "应找到其他用户的同风格笔记"
        assert result.task_id == "reuse-match-src"
        assert result.user_id == 2

    def test_find_matching_note_skips_own_task(self):
        """find_matching_note 应跳过自己的任务"""
        from app.db.video_task_dao import find_matching_note
        self._make_task_with_note("REUSE_SKIP", "跳过测试", "reuse-skip-src", user_id=1, style="detailed")
        # 用户 1 查找自己的任务应返回 None
        result = find_matching_note("REUSE_SKIP", self._PLATFORM, 1, "detailed")
        assert result is None, "不应返回自己的任务"

    def test_find_matching_note_style_mismatch(self):
        """风格不匹配时 find_matching_note 不应返回"""
        from app.db.video_task_dao import find_matching_note
        self._make_task_with_note("REUSE_STYLE", "风格测试", "reuse-style-src", user_id=2, style="detailed")
        # 用 minimal 查找（源任务是 detailed）应返回 None
        result = find_matching_note("REUSE_STYLE", self._PLATFORM, 1, "minimal")
        assert result is None, "风格不匹配不应返回"

    def test_find_completed_task_by_video_with_user_note(self):
        """find_completed_task_by_video 应找到 note_{uid}.json 格式的笔记"""
        from app.db.video_task_dao import find_completed_task_by_video
        self._make_task_with_note("REUSE_COMPLETED", "完成测试", "reuse-completed-src", user_id=2)
        result = find_completed_task_by_video("REUSE_COMPLETED", self._PLATFORM)
        assert result is not None, "应找到其他用户已完成的任务"
        assert result.task_id == "reuse-completed-src"

    def test_find_source_data_detects_media(self):
        """find_source_data 应检测到 cover.jpg 等媒体文件（图文笔记无 transcript）"""
        from app.db.video_task_dao import find_source_data
        self._make_task_with_note("REUSE_SOURCE", "源数据测试", "reuse-source-src", user_id=2)
        result = find_source_data("REUSE_SOURCE", self._PLATFORM)
        assert result is not None, "有 cover.jpg 应视为有可复用源数据"
        assert result.task_id == "reuse-source-src"

    def test_find_note_file_cross_user_glob(self):
        """find_note_file 找不到本用户 note_{uid}.json 时应回退到任意 note_*.json"""
        from app.utils.path_helper import find_note_file
        self._make_task_with_note("REUSE_GLOB", "Glob测试", "reuse-glob-src", user_id=2)
        # 用户 1 查找（没有 note_1.json，只有 note_2.json）
        result = find_note_file(
            "reuse-glob-src", self._AUTHOR_ID, self._AUTHOR_NAME,
            "REUSE_GLOB", "Glob测试", "note", self._PLATFORM, user_id=1
        )
        assert result is not None, "应通过 glob 回退找到 note_2.json"
        assert result.exists()
        assert "note_2.json" in result.name


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestGenerateNoteReuse:
    """TC01-TC04: 笔记生成 + 复用逻辑测试"""

    def test_repeat_url_returns_error(self, client, admin_token):
        """TC02: 用户重复提交相同URL应返回错误"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        # 获取已有任务（找一条 SUCCESS 且有 video_url 的）
        resp = client.get("/api/tasks?limit=50", headers={"Authorization": f"Bearer {admin_token}"})
        tasks = resp.json()["data"]["tasks"]
        task = next((t for t in tasks if t.get("video_url") and t.get("platform") and t.get("status") == "SUCCESS"), None)
        if not task:
            pytest.skip("没有可复用的 SUCCESS 任务数据")
        video_url = task.get("video_url")
        platform = task.get("platform")

        # 重复提交
        resp = client.post("/api/generate_note",
                           json={
                               "video_url": video_url,
                               "platform": platform,
                               "quality": "medium",
                               "model_name": "test",
                               "provider_id": "1",
                           },
                           headers={"Authorization": f"Bearer {admin_token}"})
        data = resp.json()
        # 应返回错误（已存在）或复用结果
        data_inner = data.get("data") or {}
        assert data["code"] != 0 or data_inner.get("reused") is True or data_inner.get("reuse_type") is not None
