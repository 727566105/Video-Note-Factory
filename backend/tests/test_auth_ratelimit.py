"""登录限流器（LoginRateLimiter）单元测试。

直接对限流器类做单测，避免通过登录端点触发全局单例
（login_rate_limiter 是模块级单例，跨测试共享，会污染其他用例）。
覆盖：
- 未超限前允许登录
- 达到最大失败次数后锁定（is_allowed=False）
- 锁定窗口到期后自动解锁
- record_success 成功登录重置计数
- 不同用户名/IP 相互隔离
"""
import time
from datetime import timedelta

import pytest

from app.auth.rate_limiter import LoginRateLimiter


def _make_limiter(**kwargs):
    return LoginRateLimiter(**kwargs)


def test_allowed_until_max_failures():
    """未达到最大失败次数前一直允许"""
    lim = _make_limiter(max_failures=3)
    for _ in range(3):
        assert lim.is_allowed("user", "1.1.1.1") is True
        lim.record_failure("user", "1.1.1.1")
    # 第 4 次（超过上限）被锁定
    assert lim.is_allowed("user", "1.1.1.1") is False


def test_locked_after_exceeding_limit():
    """达到上限后 is_allowed 返回 False"""
    lim = _make_limiter(max_failures=2)
    lim.record_failure("u", "ip")
    lim.record_failure("u", "ip")
    assert lim.is_allowed("u", "ip") is False


def test_success_resets_counter():
    """record_success 重置失败计数，即使已锁定也恢复允许"""
    lim = _make_limiter(max_failures=2)
    lim.record_failure("u", "ip")
    lim.record_failure("u", "ip")
    assert lim.is_allowed("u", "ip") is False
    lim.record_success("u", "ip")
    assert lim.is_allowed("u", "ip") is True


def test_lock_expires_after_window():
    """锁定窗口到期后自动解锁"""
    lim = _make_limiter(max_failures=2, lock_seconds=1)
    lim.record_failure("u", "ip")
    lim.record_failure("u", "ip")
    assert lim.is_allowed("u", "ip") is False
    time.sleep(1.1)
    assert lim.is_allowed("u", "ip") is True


def test_different_users_isolated():
    """不同用户名互不影响"""
    lim = _make_limiter(max_failures=2)
    lim.record_failure("alice", "ip")
    lim.record_failure("alice", "ip")
    assert lim.is_allowed("alice", "ip") is False
    assert lim.is_allowed("bob", "ip") is True


def test_different_ips_isolated():
    """同一用户名不同 IP 互不影响"""
    lim = _make_limiter(max_failures=2)
    lim.record_failure("u", "ip1")
    lim.record_failure("u", "ip1")
    assert lim.is_allowed("u", "ip1") is False
    assert lim.is_allowed("u", "ip2") is True


def test_username_case_insensitive_and_trimmed():
    """用户名大小写不敏感 + 去除首尾空白"""
    lim = _make_limiter(max_failures=1)
    lim.record_failure("  Admin ", "ip")
    assert lim.is_allowed("admin", "ip") is False
