from datetime import datetime
import json

from app.services.collection import _build_author_stats, _build_collection_summary_prompt


def test_generate_summary_uses_full_item_count_for_stale_snapshot(monkeypatch, tmp_path):
    from app.services import collection

    tasks = [
        type("Task", (), {
            "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
            "title": "有内容", "platform": "douyin", "author": "作者", "created_at": datetime(2026, 7, 12),
            "duration": None, "description": "", "tags": "{}",
        })(),
        type("Task", (), {
            "task_id": "t2", "author_id": "a2", "author_name": "作者", "video_id": "v2",
            "title": "无内容", "platform": "douyin", "author": "作者", "created_at": datetime(2026, 7, 13),
            "duration": None, "description": "", "tags": "{}",
        })(),
    ]
    items = [type("Item", (), {"task_id": task.task_id, "position": index})() for index, task in enumerate(tasks)]
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    captured = {}
    task_index = {"value": 0}

    class Query:
        def __init__(self, model):
            self.model = model
        def filter(self, *args):
            return self
        def order_by(self, *args):
            return self
        def all(self):
            return items if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                task = tasks[task_index["value"]]
                task_index["value"] += 1
                return task
            return None

    class DB:
        def query(self, model):
            return Query(model)
        def add(self, obj):
            self.saved = obj
        def commit(self):
            pass
        def refresh(self, obj):
            pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正文"}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path if kwargs["task_id"] == "t1" else None)
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type(
        "GPT", (), {"summarize": lambda self, source: captured.setdefault("prompt", source.extras) or "result"}
    )())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="overview")

    assert result["item_count_at_generation"] == 2
    assert "根据以下 1 篇笔记内容" in captured["prompt"]


def test_trajectory_prompt_requires_five_evidence_based_dimensions():
    prompt = _build_collection_summary_prompt(
        "### 笔记 1/2 | 2026-07-12 12:39 | 抖音 | 图文/实况 | 作者：a\ntext",
        2,
        None,
        mode="trajectory",
        author_name="Hiii",
        stats={"total": 2, "span_days": 0, "span_text": "2026-07-12", "frequency_per_week": 14.0,
               "peak_day": {"date": "2026-07-12", "count": 2}, "active_days": 1,
               "time_buckets": {"凌晨(0-6)": 0, "上午(6-12)": 0, "下午(12-18)": 2, "晚间(18-24)": 0},
               "platforms": {"抖音": 2}, "formats": {"图文/实况": 2}, "avg_duration_sec": None},
    )
    for heading in ("风格特征", "内容偏好", "发布规律", "人设定位", "个人特质", "创作轨迹要点"):
        assert heading in prompt
    assert "系统统计" in prompt
    assert "禁止自行数数" in prompt
    assert "互动" not in prompt


def test_non_trajectory_prompt_does_not_receive_profile_stats():
    prompt = _build_collection_summary_prompt("text", 1, None, mode="overview", stats={"total": 1})
    assert "系统统计" not in prompt
    assert "风格特征" not in prompt


def test_batch_prompt_requires_metadata_prefix_only_for_trajectory(monkeypatch):
    from app.services import collection

    captured = {}

    class GPT:
        def summarize(self, source):
            captured.setdefault("prompts", []).append(source.extras)
            return "summary"

    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())
    trajectory_result = collection._batch_summarize(
        "### 笔记 1/1 | [2026-07-12 12:39 | 抖音 | 图文/实况] | 作者：标题\n正文",
        1, None, None, "trajectory", None, None,
    )
    overview_result = collection._batch_summarize(
        "### 笔记 1/1：标题\n正文",
        1, None, None, "overview", None, None,
    )

    assert trajectory_result == "summary"
    assert overview_result == "summary"
    trajectory_prompt, overview_prompt = captured["prompts"]
    assert "必须让每篇摘要开头保留原笔记的元数据标记" in trajectory_prompt
    assert "[YYYY-MM-DD HH | 平台 | 形式]" in trajectory_prompt
    assert "必须让每篇摘要开头保留原笔记的元数据标记" not in overview_prompt
    assert "[YYYY-MM-DD HH | 平台 | 形式]" not in overview_prompt


def test_build_author_stats_uses_all_items_and_same_day_peak():
    entries = [
        {"title": "a", "platform": "douyin", "created_at": datetime(2026, 7, 12, 12, 39), "duration": None, "tags": [], "format": "图文/实况"},
        {"title": "b", "platform": "douyin", "created_at": datetime(2026, 7, 12, 13, 0), "duration": 90, "tags": [], "format": "视频"},
        {"title": "c", "platform": "bilibili", "created_at": datetime(2026, 7, 1, 8, 0), "duration": 30, "tags": [], "format": "视频"},
        {"title": "unknown", "platform": "douyin", "created_at": None, "duration": None, "tags": [], "format": "图文/实况"},
    ]
    stats = _build_author_stats(entries)
    assert stats["total"] == 4
    assert stats["span_days"] == 11
    assert stats["peak_day"] == {"date": "2026-07-12", "count": 2}
    assert stats["active_days"] == 2
    assert stats["time_buckets"]["下午(12-18)"] == 2
    assert stats["time_buckets"]["上午(6-12)"] == 1
    assert stats["platforms"] == {"抖音": 3, "B站": 1}
    assert stats["formats"] == {"图文/实况": 2, "视频": 2}
    assert stats["avg_duration_sec"] == 60


def test_build_author_stats_single_item_frequency_and_missing_dates():
    stats = _build_author_stats([
        {"title": "a", "platform": "douyin", "created_at": datetime(2026, 1, 1, 0, 0), "duration": None, "tags": [], "format": "图文/实况"},
    ])
    assert stats["span_days"] == 0
    assert stats["frequency_per_week"] == 7.0
    assert stats["time_buckets"]["凌晨(0-6)"] == 1

    missing = _build_author_stats([
        {"title": "a", "platform": "douyin", "created_at": None, "duration": None, "tags": [], "format": "图文/实况"},
    ])
    assert missing["total"] == 1
    assert missing["active_days"] == 0
    assert missing["span_text"] == "未知"


def test_build_author_stats_parity_fixture_covers_all_fields_and_edge_values():
    stats = _build_author_stats([
        {"created_at": datetime(2026, 7, 1, 0, 0), "platform": "cctv", "duration": "90", "format": "视频"},
        {"created_at": datetime(2026, 7, 2, 6, 0), "platform": "local", "duration": "", "format": "视频"},
        {"created_at": datetime(2026, 7, 3, 12, 0), "platform": "mystery", "duration": "bad", "format": "视频"},
        {"created_at": datetime(2026, 7, 4, 18, 0), "platform": None, "duration": 0, "format": "视频"},
        {"created_at": datetime(2026, 7, 1, 1, 0), "platform": "cctv", "duration": -30, "format": "视频"},
        {"created_at": None, "platform": "local", "duration": None, "format": "图文/实况"},
    ])
    assert stats == {
        "total": 6,
        "span_days": 3,
        "span_text": "3天",
        "frequency_per_week": 14.0,
        "peak_day": {"date": "2026-07-01", "count": 2},
        "active_days": 4,
        "time_buckets": {"凌晨(0-6)": 2, "上午(6-12)": 1, "下午(12-18)": 1, "晚上(18-24)": 1},
        "platforms": {"CCTV": 2, "local": 2, "mystery": 1, "": 1},
        "formats": {"视频": 5, "图文/实况": 1},
        "avg_duration_sec": 20,
    }


def test_build_author_stats_ignores_non_finite_duration_values():
    stats = _build_author_stats([
        {"created_at": None, "duration": "bad", "format": "视频", "platform": "local"},
        {"created_at": None, "duration": "", "format": "视频", "platform": "local"},
        {"created_at": None, "duration": float("nan"), "format": "视频", "platform": "local"},
        {"created_at": None, "duration": float("inf"), "format": "视频", "platform": "local"},
        {"created_at": None, "duration": 0, "format": "视频", "platform": "local"},
        {"created_at": None, "duration": -1, "format": "视频", "platform": "local"},
    ])
    assert stats["avg_duration_sec"] == 0


def test_build_author_stats_empty_entries_returns_safe_defaults():
    """空 entries：全部字段返回安全默认值，不抛异常（前端空合集统计卡片依赖此契约）"""
    stats = _build_author_stats([])
    assert stats["total"] == 0
    assert stats["span_days"] == 0
    assert stats["span_text"] == "未知"
    assert stats["frequency_per_week"] == 0.0
    assert stats["peak_day"] is None
    assert stats["active_days"] == 0
    assert stats["time_buckets"] == {"凌晨(0-6)": 0, "上午(6-12)": 0, "下午(12-18)": 0, "晚上(18-24)": 0}
    assert stats["platforms"] == {}
    assert stats["formats"] == {}
    assert stats["avg_duration_sec"] is None


def test_build_author_stats_time_bucket_23_59_goes_to_night():
    """时段半开区间边界：23:59 与 18:00 属于晚上，6:00 是上午起点"""
    stats = _build_author_stats([
        {"created_at": datetime(2026, 1, 1, 23, 59), "platform": "douyin", "duration": None, "format": "图文/实况"},
        {"created_at": datetime(2026, 1, 2, 18, 0), "platform": "douyin", "duration": None, "format": "图文/实况"},
        {"created_at": datetime(2026, 1, 3, 6, 0), "platform": "douyin", "duration": None, "format": "图文/实况"},
        {"created_at": datetime(2026, 1, 4, 0, 0), "platform": "douyin", "duration": None, "format": "图文/实况"},
    ])
    assert stats["time_buckets"]["晚上(18-24)"] == 2
    assert stats["time_buckets"]["上午(6-12)"] == 1
    assert stats["time_buckets"]["凌晨(0-6)"] == 1
    assert stats["time_buckets"]["下午(12-18)"] == 0


def test_generate_summary_gpt_exception_degrades_to_none(monkeypatch, tmp_path):
    """LLM 调用抛异常：service 捕获后返回 None（路由层映射为 400 用户提示），不冒泡成 500"""
    from app.services import collection

    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "作者", "created_at": datetime(2026, 7, 12),
        "duration": None, "description": "", "tags": "{}",
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    task_index = {"value": 0}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                task_index["value"] += 1
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正文"}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path)

    class GPT:
        def summarize(self, source):
            raise RuntimeError("llm down")

    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="overview")
    assert result is None


def test_batch_mode_full_flow_preserves_metadata_and_stats(monkeypatch, tmp_path):
    """分批模式完整链路：>12000 字触发分批，批次摘要保留元信息前缀，最终 prompt 含系统统计"""
    from app.services import collection

    tasks = []
    for i in range(7):
        tasks.append(type("Task", (), {
            "task_id": f"t{i}", "author_id": "a1", "author_name": "作者", "video_id": f"v{i}",
            "title": f"标题{i}", "platform": "douyin", "author": "作者",
            "created_at": datetime(2026, 7, 12, 10, i), "duration": 60, "description": "",
            "tags": "{}",
        })())
    items = [type("Item", (), {"task_id": t.task_id, "position": idx})() for idx, t in enumerate(tasks)]
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    captured = {"batch_prompts": [], "final_prompt": None}
    task_index = {"value": 0}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return items if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                task = tasks[task_index["value"]]
                task_index["value"] += 1
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正" * 2000}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path)

    class GPT:
        def summarize(self, source):
            if source.title == "batch":
                captured["batch_prompts"].append(source.extras)
                # 模拟批次阶段输出：开头保留元数据标记
                return "### 摘要 1\n[2026-07-12 10:00 | douyin | 视频] 批次要点"
            captured["final_prompt"] = source.extras
            return "# 最终总结"

    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")

    assert result is not None
    # 7 篇（每篇 2000 字截断）拼接超 12000 → 3 批
    assert len(captured["batch_prompts"]) == 3
    for prompt in captured["batch_prompts"]:
        assert "必须让每篇摘要开头保留原笔记的元数据标记" in prompt
        assert "[YYYY-MM-DD HH | 平台 | 形式]" in prompt
    final = captured["final_prompt"]
    assert "系统统计" in final
    assert "禁止自行数数" in final
    assert "--- 以下是 7 篇笔记内容（或其摘要） ---" in final
    # 元信息前缀经批次保留后仍出现在最终 prompt 的内容区
    assert "[2026-07-12 10:00 | douyin | 视频]" in final
    assert '"total": 7' in final
def test_trajectory_entry_metadata_is_parsed_into_prompt(monkeypatch, tmp_path):
    from app.services import collection

    created_at = datetime(2026, 7, 12, 12, 39)
    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "作者", "created_at": created_at,
        "duration": 90, "description": "描述", "tags": json.dumps({
            "platform_tags": ["平台1", "平台2", "平台3", "平台4", "平台5", "平台6"],
            "ai_tags": ["AI1", "AI2", "AI3", "AI4", "AI5", "AI6"],
        }),
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    summary_calls = {}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正文"}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path)
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type("GPT", (), {"summarize": lambda self, source: summary_calls.setdefault("prompt", source.extras) or "result"})())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")
    assert result is not None
    prompt = summary_calls["prompt"]
    assert "2026-07-12 12:39" in prompt
    assert "视频" in prompt
    assert "平台1、平台2、平台3、平台4、平台5" in prompt
    assert "AI1、AI2、AI3、AI4、AI5" in prompt
    assert "描述" in prompt
    assert "博主「作者」" in prompt
    assert '"total": 1' in prompt


def test_trajectory_author_falls_back_to_collection_name(monkeypatch, tmp_path):
    from app.services import collection

    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "", "created_at": None,
        "duration": None, "description": "", "tags": "{}",
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集作者名"})()
    summary_calls = {}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正文"}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path)
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type(
        "GPT", (), {"summarize": lambda self, source: summary_calls.setdefault("prompt", source.extras) or "result"}
    )())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")
    assert result is not None
    assert "博主「合集作者名」" in summary_calls["prompt"]


def test_transcript_fallback_used_when_note_missing(monkeypatch, tmp_path):
    """笔记缺失 → 用 transcript.json 的 full_text 兜底，header 标注 [转写原文]"""
    from app.services import collection

    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "作者",
        "created_at": datetime(2026, 7, 12, 12, 39), "duration": 90, "description": "", "tags": "{}",
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    summary_calls = {}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    transcript_path = tmp_path / "transcript.json"
    transcript_path.write_text(json.dumps({"full_text": "这是转写全文的原文内容，没有标点也保留"}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(
        collection, "find_note_file",
        lambda **kwargs: None if kwargs["file_type"] == "note" else transcript_path,
    )
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type(
        "GPT", (), {"summarize": lambda self, source: summary_calls.setdefault("prompt", source.extras) or "result"}
    )())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")
    assert result is not None
    prompt = summary_calls["prompt"]
    assert "这是转写全文的原文内容" in prompt
    assert "[转写原文]" in prompt
    # 元信息头仍完整（来自任务表，不依赖笔记）
    assert "2026-07-12 12:39" in prompt
    assert "视频" in prompt


def test_transcript_not_read_when_note_present(monkeypatch, tmp_path):
    """笔记存在 → 不读 transcript（零额外文件访问）"""
    from app.services import collection

    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "作者", "created_at": datetime(2026, 7, 12),
        "duration": None, "description": "", "tags": "{}",
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    summary_calls = {}
    requested_file_types = []

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "笔记正文内容"}, ensure_ascii=False), encoding="utf-8")
    def fake_find_note_file(**kwargs):
        requested_file_types.append(kwargs["file_type"])
        return note_path if kwargs["file_type"] == "note" else None
    monkeypatch.setattr(collection, "find_note_file", fake_find_note_file)
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type(
        "GPT", (), {"summarize": lambda self, source: summary_calls.setdefault("prompt", source.extras) or "result"}
    )())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")
    assert result is not None
    assert "笔记正文内容" in summary_calls["prompt"]
    assert "transcript" not in requested_file_types
    assert "[转写原文]" not in summary_calls["prompt"]


def test_batch_summarize_dynamic_batching_groups_by_chars(monkeypatch):
    """每批累计 ≤ 8000 字：9 篇 × 3000 字 → 每批 2 篇 → 5 批（最后一批 1 篇）"""
    from app.services import collection

    captured = []
    class GPT:
        def summarize(self, source):
            captured.append(source.extras)
            return "### 摘要\n要点"
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    parts = "\n\n---\n\n".join(["x" * 3000] * 9)
    result = collection._batch_summarize(parts, 9, None, None, "overview", None, None)

    assert result is not None
    assert len(captured) == 5, f"期望 5 批（每批 2 篇，最后一批 1 篇），实际 {len(captured)} 批"
    for prompt in captured[:4]:
        assert "请将以下 2 篇笔记" in prompt
    assert "请将以下 1 篇笔记" in captured[4]


def test_batch_summarize_long_entry_compressed_first(monkeypatch):
    """单篇 > 8000 字：先单独压缩（title=long-entry），再参与批次；trajectory 保留元数据指令"""
    from app.services import collection

    calls = []
    prompts = []
    class GPT:
        def summarize(self, source):
            calls.append(source.title)
            prompts.append(source.extras)
            if source.title == "long-entry":
                assert "不超过 1000 字" in source.extras
                assert "必须让摘要开头保留原笔记的元数据标记" in source.extras
                return "### 摘要\n[2026-07-12 10:00 | douyin | 视频] 压缩后的要点"
            return "### 摘要\n批次要点"
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    long_part = "y" * 10000
    short_part = "z" * 1000
    parts = "\n\n---\n\n".join([long_part, short_part])
    result = collection._batch_summarize(parts, 2, None, None, "trajectory", None, None)

    assert calls == ["long-entry", "batch"], f"调用序列异常: {calls}"
    assert result is not None
    # 压缩摘要作为批次输入参与后续总结（最终 result 是批次 GPT 的输出）
    assert "压缩后的要点" in prompts[1]


def test_batch_summarize_long_entry_compression_failure_degrades(monkeypatch):
    """超长单篇压缩失败 → 截断到 8000 字直接参与批次，不丢条目"""
    from app.services import collection

    captured = []
    class GPT:
        def summarize(self, source):
            if source.title == "long-entry":
                raise RuntimeError("compression failed")
            captured.append(source.extras)
            return "### 摘要\n批次要点"
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    parts = "\n\n---\n\n".join(["y" * 10000, "z" * 1000])
    result = collection._batch_summarize(parts, 2, None, None, "overview", None, None)

    assert result is not None
    # 截断后 8000+10 分隔符开销 > 8000，与短篇不能同批 → 2 批
    assert len(captured) == 2, f"期望 2 批（截断条目与短篇各一批），实际 {len(captured)} 批"
    assert "y" * 8000 in captured[0]
    assert "z" * 1000 in captured[1]


def test_corrupt_transcript_skips_entry_without_crashing(monkeypatch, tmp_path):
    """转写 JSON 损坏 → 该条目跳过，其余条目正常生成，不抛异常"""
    from app.services import collection

    tasks = [
        type("Task", (), {
            "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
            "title": "正常笔记", "platform": "douyin", "author": "作者",
            "created_at": datetime(2026, 7, 12), "duration": None, "description": "", "tags": "{}",
        })(),
        type("Task", (), {
            "task_id": "t2", "author_id": "a2", "author_name": "作者", "video_id": "v2",
            "title": "坏转写", "platform": "bilibili", "author": "作者",
            "created_at": datetime(2026, 7, 13), "duration": None, "description": "", "tags": "{}",
        })(),
    ]
    items = [type("Item", (), {"task_id": t.task_id, "position": index})() for index, t in enumerate(tasks)]
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()
    summary_calls = {}
    task_index = {"value": 0}

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return items if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                task = tasks[task_index["value"]]
                task_index["value"] += 1
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正常笔记正文"}, ensure_ascii=False), encoding="utf-8")
    transcript_path = tmp_path / "transcript.json"
    transcript_path.write_text("{ 这不是合法JSON", encoding="utf-8")
    def fake_find_note_file(**kwargs):
        if kwargs["file_type"] == "note":
            return note_path if kwargs["task_id"] == "t1" else None
        return transcript_path if kwargs["task_id"] == "t2" else None
    monkeypatch.setattr(collection, "find_note_file", fake_find_note_file)
    monkeypatch.setattr(collection, "_get_gpt", lambda *args: type(
        "GPT", (), {"summarize": lambda self, source: summary_calls.setdefault("prompt", source.extras) or "result"}
    )())

    result = collection.generate_collection_summary(DB(), "c1", 1, mode="trajectory")
    assert result is not None
    prompt = summary_calls["prompt"]
    assert "正常笔记正文" in prompt
    assert "坏转写" not in prompt
    assert '"total": 1' in prompt
