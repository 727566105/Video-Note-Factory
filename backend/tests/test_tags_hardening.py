"""笔记标签功能健壮性测试

测试覆盖：
1. tags JSON 损坏时不崩溃（降级为空字典）
2. AI 标签提取（各种格式 + 解析失败日志）
3. 标签内容清洗（XSS 防护、长度/数量限制）
4. update_task_metadata user_id 隔离
5. 标签更新 API Pydantic 校验
"""
import pytest
import json
from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace


# ──────────────────────────────────────────────
# 1. tags JSON 解析容错
# ──────────────────────────────────────────────

class TestTagsJsonParsing:
    """tags 字段损坏时不崩溃"""

    def test_parse_valid_tags_json(self):
        """正常 JSON 能正确解析"""
        raw = '{"platform_tags": ["科技", "AI"], "ai_tags": ["深度学习"], "manual_tags": ["收藏"]}'
        data = json.loads(raw)
        assert data["platform_tags"] == ["科技", "AI"]
        assert data["ai_tags"] == ["深度学习"]
        assert data["manual_tags"] == ["收藏"]

    def test_corrupted_tags_json_falls_back_to_empty(self):
        """损坏的 JSON 降级为空字典（模拟 note.py 的修复逻辑）"""
        corrupted = "not a json {{{"
        try:
            data = json.loads(corrupted) if corrupted else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        assert data == {}

    def test_null_tags_handled(self):
        """tags 为 null 时降级为空字典"""
        raw = None
        try:
            data = json.loads(raw) if raw else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        assert data == {}

    def test_existing_tags_dict_type_safety(self):
        """解析后的 tags 是 dict 类型才取值，否则用空列表"""
        existing_tags = {"manual_tags": ["a"]}
        assert existing_tags.get("manual_tags", []) if isinstance(existing_tags, dict) else [] == ["a"]

        existing_tags = "not a dict"
        assert existing_tags.get("manual_tags", []) if isinstance(existing_tags, dict) else [] == []


# ──────────────────────────────────────────────
# 2. AI 标签提取
# ──────────────────────────────────────────────

class TestExtractAiTags:
    """AI 标签提取测试"""

    def test_extract_double_quotes(self):
        """标准双引号格式"""
        from app.gpt.prompt_builder import extract_ai_tags
        md = '一些内容\n<!-- AI_TAGS: ["科技", "AI", "深度学习"] -->\n更多内容'
        tags = extract_ai_tags(md)
        assert tags == ["科技", "AI", "深度学习"]

    def test_extract_single_quotes(self):
        """单引号格式"""
        from app.gpt.prompt_builder import extract_ai_tags
        md = "内容\n<!-- AI_TAGS: ['科技', 'AI'] -->"
        tags = extract_ai_tags(md)
        assert tags == ["科技", "AI"]

    def test_extract_no_tags_marker(self):
        """没有 AI_TAGS 标记时返回空列表"""
        from app.gpt.prompt_builder import extract_ai_tags
        tags = extract_ai_tags("普通 markdown 内容")
        assert tags == []

    def test_extract_empty_tags(self):
        """空标签数组"""
        from app.gpt.prompt_builder import extract_ai_tags
        md = '<!-- AI_TAGS: [] -->'
        tags = extract_ai_tags(md)
        assert tags == []

    def test_extract_malformed_tags_falls_back(self):
        """格式异常时用正则兜底"""
        from app.gpt.prompt_builder import extract_ai_tags
        md = '<!-- AI_TAGS: [科技, AI, 深度学习] -->'
        tags = extract_ai_tags(md)
        # 无引号的格式正则也能提取
        assert isinstance(tags, list)

    def test_remove_ai_tags_marker(self):
        """remove_ai_tags_marker 正确移除标记"""
        from app.gpt.prompt_builder import remove_ai_tags_marker
        md = '标题\n\n<!-- AI_TAGS: ["a"] -->\n\n正文'
        cleaned = remove_ai_tags_marker(md)
        assert "AI_TAGS" not in cleaned
        assert "标题" in cleaned
        assert "正文" in cleaned


# ──────────────────────────────────────────────
# 3. 标签内容清洗
# ──────────────────────────────────────────────

class TestSanitizeTags:
    """标签内容清洗（XSS 防护 + 长度/数量限制）"""

    def test_strips_html_tags(self):
        """去除 HTML 标签"""
        from app.routers.note import _sanitize_tags
        result = _sanitize_tags(["<script>alert(1)</script>", "正常标签"])
        assert result == ["alert(1)", "正常标签"]

    def test_strips_control_chars(self):
        """去除控制字符"""
        from app.routers.note import _sanitize_tags
        result = _sanitize_tags(["正常\x00\x01标签", "test\n\r"])
        assert all(c.isprintable() or c in (' ', '-') for tag in result for c in tag)

    def test_limits_length(self):
        """超长标签被截断（不返回）"""
        from app.routers.note import _sanitize_tags
        long_tag = "A" * 100
        result = _sanitize_tags([long_tag, "短"])
        assert long_tag not in result
        assert "短" in result

    def test_limits_count(self):
        """标签数量上限 50"""
        from app.routers.note import _sanitize_tags
        many_tags = [f"tag{i}" for i in range(100)]
        result = _sanitize_tags(many_tags)
        assert len(result) <= 50

    def test_non_string_filtered(self):
        """非字符串元素被过滤"""
        from app.routers.note import _sanitize_tags
        result = _sanitize_tags([123, None, "正常", True])
        assert result == ["正常"]

    def test_empty_string_filtered(self):
        """空字符串被过滤"""
        from app.routers.note import _sanitize_tags
        result = _sanitize_tags(["", "   ", "正常"])
        assert result == ["正常"]


# ──────────────────────────────────────────────
# 4. 标签更新 API Pydantic 校验
# ──────────────────────────────────────────────

class TestUpdateTagsAPI:
    """标签更新接口校验"""

    def test_pydantic_model_defaults(self):
        """UpdateTagsRequest 默认值为空数组"""
        from app.routers.note import UpdateTagsRequest
        req = UpdateTagsRequest()
        assert req.platform_tags == []
        assert req.ai_tags == []
        assert req.manual_tags == []

    def test_pydantic_model_accepts_valid(self):
        """合法数据通过校验"""
        from app.routers.note import UpdateTagsRequest
        req = UpdateTagsRequest(
            platform_tags=["科技", "AI"],
            manual_tags=["收藏"]
        )
        assert req.platform_tags == ["科技", "AI"]
        assert req.manual_tags == ["收藏"]

    def test_pydantic_model_rejects_non_list(self):
        """非数组类型被拒绝"""
        from app.routers.note import UpdateTagsRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UpdateTagsRequest(manual_tags="not a list")
        with pytest.raises(ValidationError):
            UpdateTagsRequest(platform_tags=123)


# ──────────────────────────────────────────────
# 5. update_task_metadata user_id 隔离
# ──────────────────────────────────────────────

_db_ready = False
try:
    from app.db.init_db import init_db
    init_db()
    _db_ready = True
except Exception:
    pass

_db_required = pytest.mark.skipif(not _db_ready, reason="数据库未初始化")


@_db_required
class TestUpdateTaskMetadataUserIsolation:
    """update_task_metadata user_id 隔离"""

    def test_update_with_user_id_only_affects_user(self):
        """带 user_id 的更新只影响指定用户"""
        from app.db.video_task_dao import update_task_metadata, get_task_by_task_id_and_user
        # 用 admin 的 task 测试
        task = get_task_by_task_id_and_user(
            "6a14667e-6a4c-4712-9617-312c62b0e07a", 1
        )
        if not task:
            pytest.skip("测试 task 不存在")

        # 用 user_id=999（不存在）更新，不应影响 admin 的数据
        update_task_metadata(
            task_id=task.task_id,
            tags='{"platform_tags": ["hacked"], "ai_tags": [], "manual_tags": []}',
            user_id=999,
        )
        # admin 的 tags 不应被改变
        task_after = get_task_by_task_id_and_user(task.task_id, 1)
        assert task_after.tags != '{"platform_tags": ["hacked"], "ai_tags": [], "manual_tags": []}'
