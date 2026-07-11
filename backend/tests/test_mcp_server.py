"""MCP Server 功能与安全测试

测试覆盖：
1. API Key 生成/验证/撤销
2. MCP 鉴权（无 Key 拒绝、无效 Key 拒绝、有效 Key 通过）
3. 参数校验（task_id UUID 格式、limit 上限、quality 枚举、URL 协议白名单）
4. 工具功能正确性（list_notes/list_subscriptions/get_feed/list_collections）
5. contextvars 用户隔离
"""
import pytest
import asyncio
import hashlib
import json
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

# 尝试初始化数据库
_db_ready = False
try:
    from app.db.init_db import init_db
    init_db()
    _db_ready = True
except Exception:
    pass

_db_required = pytest.mark.skipif(not _db_ready, reason="数据库未初始化")


# ──────────────────────────────────────────────
# 第一层：API Key 生成/验证/撤销
# ──────────────────────────────────────────────

@_db_required
class TestAPIKeyManagement:
    """API Key 生成、哈希存储、验证、撤销"""

    def test_generate_api_key_returns_vn_prefix(self):
        """生成的 API Key 应以 vn_ 开头，长度 35"""
        from app.db.user_dao import generate_api_key, get_api_key_info
        key = generate_api_key(1)
        assert key.startswith("vn_")
        assert len(key) == 35  # vn_ (3) + 32 hex

        info = get_api_key_info(1)
        assert info["exists"] is True
        assert info["masked"].startswith("vn_")
        assert "*" in info["masked"]

    def test_api_key_hash_stored_not_plaintext(self):
        """数据库应存哈希，不是明文"""
        from app.db.user_dao import generate_api_key, get_user_by_username
        key = generate_api_key(1)
        user = get_user_by_username("admin")
        # api_key_hash 应该是 SHA-256
        expected_hash = hashlib.sha256(key.encode()).hexdigest()
        assert user.api_key_hash == expected_hash
        assert len(user.api_key_hash) == 64  # SHA-256 hex

    def test_get_user_by_api_key_validates_format(self):
        """非法格式的 key 应返回 None"""
        from app.db.user_dao import get_user_by_api_key
        assert get_user_by_api_key(None) is None
        assert get_user_by_api_key("") is None
        assert get_user_by_api_key("invalid") is None
        assert get_user_by_api_key("vn_short") is None
        assert get_user_by_api_key("vn_Z" * 16) is None  # 非 hex 字符
        assert get_user_by_api_key("'; DROP TABLE users; --") is None

    def test_get_user_by_api_key_returns_user(self):
        """有效 key 应返回用户对象"""
        from app.db.user_dao import generate_api_key, get_user_by_api_key
        key = generate_api_key(1)
        user = get_user_by_api_key(key)
        assert user is not None
        assert user.username == "admin"

    def test_clear_api_key(self):
        """撤销 API Key 后应无法通过 key 查到用户"""
        from app.db.user_dao import generate_api_key, clear_api_key, get_user_by_api_key
        key = generate_api_key(1)
        assert get_user_by_api_key(key) is not None
        assert clear_api_key(1) is True
        assert get_user_by_api_key(key) is None


# ──────────────────────────────────────────────
# 第二层：MCP 鉴权
# ──────────────────────────────────────────────

@_db_required
class TestMCPAuth:
    """MCP 端点鉴权测试"""

    def test_no_api_key_returns_401(self):
        """无 API Key 应返回 401"""
        from fastapi import FastAPI
        from starlette.testclient import TestClient
        from app.mcp_server import mcp_auth_middleware, mcp

        app = FastAPI()
        app.mount("/", mcp_auth_middleware)

        with TestClient(app) as client:
            resp = client.post("/mcp", json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "test", "version": "1.0"}}
            }, headers={"Accept": "application/json, text/event-stream"})
            assert resp.status_code == 401

    def test_invalid_api_key_returns_401(self):
        """无效 API Key 应返回 401"""
        from fastapi import FastAPI
        from starlette.testclient import TestClient
        from app.mcp_server import mcp_auth_middleware

        app = FastAPI()
        app.mount("/", mcp_auth_middleware)

        with TestClient(app) as client:
            resp = client.post("/mcp", json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "test", "version": "1.0"}}
            }, headers={
                "Authorization": "Bearer vn_invalid_key_that_does_not_exist",
                "Accept": "application/json, text/event-stream",
            })
            assert resp.status_code == 401

    def test_double_bearer_prefix_accepted(self):
        """双 Bearer 前缀应被容错处理"""
        from app.db.user_dao import generate_api_key, get_user_by_api_key
        key = generate_api_key(1)
        # 模拟中间件解析
        auth_header = f"Bearer Bearer {key}"
        token = auth_header.strip()
        while token.startswith("Bearer "):
            token = token[7:].strip()
        assert token == key
        assert get_user_by_api_key(token) is not None


# ──────────────────────────────────────────────
# 第三层：参数校验
# ──────────────────────────────────────────────

class TestParameterValidation:
    """参数校验逻辑测试（不需要数据库）"""

    def test_validate_video_url_rejects_file_protocol(self):
        from app.mcp_server import _validate_video_url
        assert _validate_video_url("file:///etc/passwd") is not None
        assert _validate_video_url("javascript:alert(1)") is not None
        assert _validate_video_url("ftp://example.com/file") is not None

    def test_validate_video_url_accepts_https(self):
        from app.mcp_server import _validate_video_url
        assert _validate_video_url("https://www.bilibili.com/video/BV1xx") is None
        assert _validate_video_url("http://example.com") is None

    def test_validate_video_url_rejects_empty_and_long(self):
        from app.mcp_server import _validate_video_url
        assert _validate_video_url("") is not None
        assert _validate_video_url("x" * 3000) is not None

    def test_validate_task_id_rejects_non_uuid(self):
        from app.mcp_server import _validate_task_id
        assert _validate_task_id("not-a-uuid") is not None
        assert _validate_task_id("") is not None
        assert _validate_task_id("12345") is not None

    def test_validate_task_id_accepts_valid_uuid(self):
        from app.mcp_server import _validate_task_id
        assert _validate_task_id("6a14667e-6a4c-4712-9617-312c62b0e07a") is None

    def test_clamp_limit_bounds(self):
        from app.mcp_server import _clamp_limit
        assert _clamp_limit(99999) == 200  # 上限
        assert _clamp_limit(0) == 20       # 下限回退
        assert _clamp_limit(-5) == 20      # 负数回退
        assert _clamp_limit(50) == 50      # 正常值
        assert _clamp_limit(200) == 200    # 边界

    def test_detect_platform(self):
        from app.mcp_server import detect_platform
        assert detect_platform("https://www.bilibili.com/video/BV1xx") == "bilibili"
        assert detect_platform("https://b23.tv/abc") == "bilibili"
        assert detect_platform("https://www.youtube.com/watch?v=abc") == "youtube"
        assert detect_platform("https://www.douyin.com/video/123") == "douyin"
        assert detect_platform("https://www.xiaohongshu.com/explore/123") == "xiaohongshu"
        assert detect_platform("https://xhslink.com/abc") == "xiaohongshu"


# ──────────────────────────────────────────────
# 第四层：contextvars 用户隔离
# ──────────────────────────────────────────────

class TestContextvarsIsolation:
    """contextvars 请求级用户隔离测试"""

    def test_contextvar_set_and_reset(self):
        """contextvar 设置后能读取，reset 后恢复默认"""
        import contextvars
        from app.mcp_server import _mcp_user

        assert _mcp_user.get() is None  # 默认无用户

        token = _mcp_user.set({"user_id": 1, "username": "alice"})
        assert _mcp_user.get()["username"] == "alice"

        _mcp_user.reset(token)
        assert _mcp_user.get() is None  # reset 后恢复

    def test_contextvar_not_leaked_between_contexts(self):
        """不同 context 之间不泄露"""
        import contextvars
        from app.mcp_server import _mcp_user

        async def request_a():
            token = _mcp_user.set({"user_id": 1, "username": "alice"})
            await asyncio.sleep(0.01)
            user = _mcp_user.get()
            _mcp_user.reset(token)
            return user

        async def request_b():
            token = _mcp_user.set({"user_id": 2, "username": "bob"})
            await asyncio.sleep(0.01)
            user = _mcp_user.get()
            _mcp_user.reset(token)
            return user

        async def run():
            # 并发执行两个请求
            results = await asyncio.gather(request_a(), request_b())
            return results

        results = asyncio.run(run())
        assert results[0]["username"] == "alice"
        assert results[1]["username"] == "bob"


# ──────────────────────────────────────────────
# 第五层：端到端 MCP 工具调用
# ──────────────────────────────────────────────

@_db_required
class TestMCPEndToEnd:
    """端到端 MCP 工具调用测试（需要后端运行）"""

    @pytest.fixture
    def api_key(self):
        from app.db.user_dao import generate_api_key
        return generate_api_key(1)

    @pytest.fixture
    def mcp_url(self):
        return "http://127.0.0.1:8483/mcp"

    def _call_mcp_tool(self, api_key, mcp_url, tool_name, arguments):
        """同步包装 MCP 工具调用"""
        async def _call():
            from mcp.client.session import ClientSession
            from mcp.client.streamable_http import streamablehttp_client

            async with streamablehttp_client(
                mcp_url,
                headers={"Authorization": f"Bearer {api_key}"}
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
                    return json.loads(result.content[0].text)

        return asyncio.run(_call())

    def test_list_notes_returns_list(self, api_key, mcp_url):
        """list_notes 应返回笔记列表"""
        data = self._call_mcp_tool(api_key, mcp_url, "list_notes", {"limit": 5})
        assert isinstance(data, list)
        if data:
            note = data[0]
            assert "task_id" in note
            assert "title" in note
            assert "platform" in note
            assert "status" in note

    def test_list_subscriptions_returns_list(self, api_key, mcp_url):
        """list_subscriptions 应返回订阅列表"""
        data = self._call_mcp_tool(api_key, mcp_url, "list_subscriptions", {})
        assert isinstance(data, list)

    def test_get_feed_returns_list(self, api_key, mcp_url):
        """get_feed 应返回动态列表"""
        data = self._call_mcp_tool(api_key, mcp_url, "get_feed", {"limit": 5})
        assert isinstance(data, list)

    def test_list_collections_returns_data(self, api_key, mcp_url):
        """list_collections 应返回合集数据"""
        data = self._call_mcp_tool(api_key, mcp_url, "list_collections", {})
        # 可能是 list 或 dict
        assert data is not None

    def test_invalid_task_id_returns_error(self, api_key, mcp_url):
        """非法 task_id 应返回错误"""
        data = self._call_mcp_tool(api_key, mcp_url, "get_task_status", {"task_id": "not-a-uuid"})
        assert "error" in data
        assert "格式无效" in data["error"]

    def test_invalid_url_protocol_rejected(self, api_key, mcp_url):
        """file:// 协议应被拒绝"""
        data = self._call_mcp_tool(api_key, mcp_url, "import_video", {"video_url": "file:///etc/passwd"})
        assert "error" in data
        assert "协议" in data["error"]

    def test_invalid_quality_rejected(self, api_key, mcp_url):
        """非法 quality 应被拒绝"""
        data = self._call_mcp_tool(api_key, mcp_url, "import_video", {
            "video_url": "https://www.bilibili.com/video/BV1xx",
            "quality": "ultra_fast"
        })
        assert "error" in data
        assert "quality" in data["error"]

    def test_limit_capped_at_200(self, api_key, mcp_url):
        """limit=99999 应被限制为 200"""
        data = self._call_mcp_tool(api_key, mcp_url, "list_notes", {"limit": 99999})
        assert isinstance(data, list)
        assert len(data) <= 200
