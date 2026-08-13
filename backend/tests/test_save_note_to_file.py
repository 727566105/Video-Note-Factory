"""save_note_to_file 结果文件落盘测试。

回归场景：上传本地音视频（local/local_audio 平台）生成笔记后，
note_{user_id}.json 必须落在正式目录
data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/。

历史 bug：local_audio 的 AudioDownloadResult.author_id 恒为 None，
且视频分支组装 NoteResult 未传顶层 author_id/video_id/title/platform，
导致 save_note_to_file 走 _pending/{task_id}/note_1.json 分支，
任务结束 _pending 被清理 -> 结果文件丢失（status 已 SUCCESS，
前端报"任务完成，但结果文件未找到"）。
"""
import json

import pytest

import app.utils.path_helper as path_helper
from app.models.notes_model import AudioDownloadResult, NoteResult
from app.routers.note import save_note_to_file


@pytest.fixture
def video_dir(tmp_path, monkeypatch):
    """隔离的 VIDEO_DIR，避免污染真实 data/"""
    monkeypatch.setattr(path_helper, "VIDEO_DIR", tmp_path / "video")
    return tmp_path / "video"


def _make_note(audio_author_id=None, note_author_id=None, note_author_name=None,
               user_id=1, platform="local_audio", video_id="demo"):
    """构造 local_audio 场景的 NoteResult。

    :param audio_author_id: audio_meta.author_id（local 下载器恒为 None）
    :param note_author_id: NoteResult 顶层 author_id（视频分支修复前为 None）
    """
    audio_meta = AudioDownloadResult(
        file_path="/uploads/demo.wav",
        title=video_id,
        duration=0,
        cover_url="",
        platform=platform,
        video_id=video_id,
        raw_info={},
        video_path=None,
        author_id=audio_author_id,
        author_name="someone" if audio_author_id else None,
    )
    return NoteResult(
        markdown="# 测试笔记",
        audio_meta=audio_meta,
        title=video_id,
        author_id=note_author_id,
        author_name=note_author_name,
        video_id=video_id,
        platform=platform,
        user_id=user_id,
    )


def _read_note(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_audio_meta_full_writes_formal_dir(video_dir):
    """网络平台：audio_meta 有 author_id -> 正式目录（现有行为不回归）"""
    note = _make_note(audio_author_id="123")
    save_note_to_file("task-1", note)
    target = video_dir / "local" / "123_someone" / "demo_demo" / "note_1.json"
    assert target.exists()
    assert _read_note(target)["markdown"] == "# 测试笔记"


def test_note_top_level_author_fallback(video_dir):
    """audio_meta 无 author 但 NoteResult 顶层有（视频分支修复后）-> 正式目录"""
    note = _make_note(note_author_id="1", note_author_name="admin")
    save_note_to_file("task-2", note)
    target = video_dir / "local" / "1_admin" / "demo_demo" / "note_1.json"
    assert target.exists()
    # 不得落 _pending（会被清理）
    assert not (video_dir / "_pending" / "task-2" / "note_1.json").exists()


def test_local_platform_user_id_fallback(video_dir):
    """audio_meta/顶层都无 author + local 平台 -> 用 user_id 兜底到正式目录"""
    note = _make_note(user_id=1)
    save_note_to_file("task-3", note)
    pending = video_dir / "_pending" / "task-3" / "note_1.json"
    assert not pending.exists(), "结果文件不得写入 _pending（会被清理）"
    # 兜底后应写入正式目录（author_id=user_id 前缀）
    formal = video_dir / "local" / "1" / "demo_demo" / "note_1.json"
    assert formal.exists() or list(video_dir.glob("local/1_*/demo_demo/note_1.json"))


def test_local_video_platform_same_as_audio(video_dir):
    """local 视频平台与 local_audio 走相同兜底：video_id 缺失时回退顶层字段"""
    note = _make_note(platform="local", video_id="movie")
    save_note_to_file("task-4", note)
    pending = video_dir / "_pending" / "task-4" / "note_1.json"
    assert not pending.exists(), "local 视频结果文件不得写入 _pending"
    assert list(video_dir.glob("local/1_*/movie_movie/note_1.json"))


def test_cross_user_notes_isolated(video_dir):
    """跨用户：不同 user_id 的 note_{user_id}.json 落在各自目录，互不覆盖"""
    note_a = _make_note(user_id=1)
    save_note_to_file("task-a", note_a)
    note_b = _make_note(user_id=2)
    save_note_to_file("task-b", note_b)

    targets = list(video_dir.glob("local/1_*/demo_demo/note_1.json"))
    targets_b = list(video_dir.glob("local/2_*/demo_demo/note_2.json"))
    assert targets, "user 1 的笔记应落盘"
    assert targets_b, "user 2 的笔记应落盘"
    # 各自目录独立（不同 author_id 前缀），互不覆盖
    assert targets[0] != targets_b[0]
    assert _read_note(targets[0])["markdown"] == "# 测试笔记"
    assert _read_note(targets_b[0])["markdown"] == "# 测试笔记"
