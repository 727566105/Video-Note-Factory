"""MCP 多用户加固测试

验证：
- 限流器：分级限流、滑动窗口、过期清理
- 线程池：并发上限
- DB 异步包装：不阻塞 event loop
- API Key 安全：created_at / last_used_at 追踪

运行: cd backend && python3 -m pytest tests/test_mcp_hardening.py -v
"""
import time
import asyncio
import threading
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from types import SimpleNamespace

import pytest

from app.mcp_rate_limiter import (
    check_rate_limit, reset_rate_limit, cleanup_stale_entries,
    _user_limits, HEAVY_LIMIT, LIGHT_LIMIT, WINDOW_SECONDS,
)


# ==================== 限流器测试 ====================

class TestRateLimiter:

    def setup_method(self):
        reset_rate_limit()

    def teardown_method(self):
        reset_rate_limit()

    def test_allows_under_limit(self):
        """未超限的请求正常通过"""
        for i in range(HEAVY_LIMIT):
            allowed, retry = check_rate_limit(1, "import_video")
            assert allowed is True, f"第 {i+1} 次应放行"
            assert retry == 0

    def test_blocks_over_limit_heavy(self):
        """重操作超限返回拒绝"""
        for _ in range(HEAVY_LIMIT):
            check_rate_limit(1, "import_video")

        allowed, retry = check_rate_limit(1, "import_video")
        assert allowed is False, "超限应拒绝"
        assert retry > 0, "应返回重试等待秒数"

    def test_blocks_over_limit_light(self):
        """轻操作超限返回拒绝"""
        for _ in range(LIGHT_LIMIT):
            check_rate_limit(1, "list_notes")

        allowed, retry = check_rate_limit(1, "list_notes")
        assert allowed is False, "超限应拒绝"
        assert retry > 0

    def test_heavy_and_light_independent(self):
        """重操作和轻操作独立计数"""
        # 用完重操作配额
        for _ in range(HEAVY_LIMIT):
            check_rate_limit(1, "import_video")

        # 轻操作仍可用
        allowed, _ = check_rate_limit(1, "list_notes")
        assert allowed is True, "轻操作不受重操作限制影响"

    def test_different_users_independent(self):
        """不同用户限流独立"""
        for _ in range(HEAVY_LIMIT):
            check_rate_limit(1, "import_video")

        # 用户 2 不受用户 1 的限制
        allowed, _ = check_rate_limit(2, "import_video")
        assert allowed is True, "不同用户限流独立"

    def test_window_slides(self):
        """滑动窗口：超过窗口期后限制重置"""
        # 手动注入过期时间戳（模拟窗口已过）
        with patch("app.mcp_rate_limiter.time.monotonic") as mock_time:
            base = 1000.0
            mock_time.return_value = base
            for _ in range(HEAVY_LIMIT):
                check_rate_limit(1, "import_video")

            # 窗口内应被拒
            mock_time.return_value = base + 10
            allowed, _ = check_rate_limit(1, "import_video")
            assert allowed is False

            # 窗口外应放行
            mock_time.return_value = base + WINDOW_SECONDS + 1
            allowed, _ = check_rate_limit(1, "import_video")
            assert allowed is True, "超过窗口期应重置限制"

    def test_cleans_stale_entries(self):
        """超过 10 分钟无请求的用户条目被清理"""
        # 创建用户 1 和 2 的条目
        check_rate_limit(1, "list_notes")
        check_rate_limit(2, "list_notes")
        assert 1 in _user_limits
        assert 2 in _user_limits

        # 模拟过期
        for uid in _user_limits:
            _user_limits[uid]["last"] = time.monotonic() - 9999

        cleanup_stale_entries()
        assert len(_user_limits) == 0, "过期条目应被清理"


# ==================== 线程池测试 ====================

class TestThreadPool:

    def test_thread_pool_limits_concurrency(self):
        """线程池 max_workers 上限生效"""
        from app.mcp_server import _background_executor
        assert _background_executor._max_workers == 10

    def test_safe_run_in_thread_executes(self):
        """_safe_run_in_thread 正常执行任务"""
        from app.mcp_server import _safe_run_in_thread

        result = {"done": False}
        done_event = threading.Event()

        def task():
            result["done"] = True
            done_event.set()

        _safe_run_in_thread(task)
        assert done_event.wait(timeout=5), "任务应在 5 秒内完成"
        assert result["done"] is True

    def test_safe_run_in_thread_catches_exception(self):
        """_safe_run_in_thread 捕获异常不传播"""
        from app.mcp_server import _safe_run_in_thread

        def bad_task():
            raise RuntimeError("测试异常")

        # 不应抛异常
        _safe_run_in_thread(bad_task)
        # 等一下让线程池处理完
        import time as _t
        _t.sleep(0.5)


# ==================== DB 异步包装测试 ====================

class TestAsyncDBWrapper:

    def test_run_sync_returns_result(self):
        """_run_sync 正确返回同步函数结果"""
        from app.mcp_server import _run_sync

        def sync_func(x, y):
            return x + y

        result = asyncio.run(_run_sync(sync_func, 1, 2))
        assert result == 3

    def test_run_sync_with_kwargs(self):
        """_run_sync 支持 kwargs"""
        from app.mcp_server import _run_sync

        def sync_func(a, b=10):
            return a * b

        result = asyncio.run(_run_sync(sync_func, 5, b=3))
        assert result == 15

    def test_run_sync_does_not_block_event_loop(self):
        """_run_sync 不阻塞 event loop（可以并发执行）"""
        from app.mcp_server import _run_sync

        def slow_task(n):
            time.sleep(0.2)
            return n

        async def main():
            # 两个慢任务并发执行，总耗时应 < 0.4s（如果串行则 >= 0.4s）
            t0 = time.monotonic()
            r1, r2 = await asyncio.gather(
                _run_sync(slow_task, 1),
                _run_sync(slow_task, 2),
            )
            elapsed = time.monotonic() - t0
            return r1, r2, elapsed

        r1, r2, elapsed = asyncio.run(main())
        assert r1 == 1 and r2 == 2
        assert elapsed < 0.4, f"并发执行耗时应 < 0.4s，实际 {elapsed:.2f}s"


# ==================== API Key 安全增强测试 ====================

class TestAPIKeyTracking:

    def test_generate_api_key_sets_created_at(self):
        """生成 API Key 时设置 created_at"""
        from app.db.user_dao import generate_api_key
        from app.db.models.users import User
        from app.db.engine import get_db

        # mock 用户
        mock_user = SimpleNamespace(
            id=1, username="admin", api_key=None, api_key_hash=None,
            api_key_created_at=None, api_key_last_used_at=None,
        )

        with patch("app.db.user_dao.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.query.return_value.filter_by.return_value.first.return_value = mock_user
            mock_get_db.return_value = iter([mock_db])

            api_key = generate_api_key(1)

            assert api_key.startswith("vn_")
            assert mock_user.api_key_created_at is not None, "应设置 created_at"
            assert mock_user.api_key_last_used_at is None, "生成时 last_used 应为空"

    def test_get_user_by_api_key_updates_last_used(self):
        """认证成功后更新 last_used_at"""
        from app.db.user_dao import get_user_by_api_key
        from datetime import datetime

        mock_user = SimpleNamespace(
            id=1, username="admin", role="admin",
            api_key="vn_" + "a" * 32,
            api_key_hash=None,  # 会被设置
            api_key_created_at=datetime.now(),
            api_key_last_used_at=None,
        )

        with patch("app.db.user_dao.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.query.return_value.filter_by.return_value.first.return_value = mock_user
            mock_get_db.return_value = iter([mock_db])

            user = get_user_by_api_key("vn_" + "a" * 32)

            assert user is not None
            assert mock_user.api_key_last_used_at is not None, "应更新 last_used_at"

    def test_get_api_key_info_returns_timestamps(self):
        """get_api_key_info 返回 created_at 和 last_used_at"""
        from app.db.user_dao import get_api_key_info

        now = datetime.now()
        mock_user = SimpleNamespace(
            api_key="vn_abcdef1234567890abcdef1234567890",
            api_key_created_at=now,
            api_key_last_used_at=now - timedelta(hours=2),
        )

        with patch("app.db.user_dao.get_db") as mock_get_db:
            mock_db = MagicMock()
            mock_db.query.return_value.filter_by.return_value.first.return_value = mock_user
            mock_get_db.return_value = iter([mock_db])

            info = get_api_key_info(1)

            assert info["exists"] is True
            assert info["created_at"] is not None
            assert info["last_used_at"] is not None
