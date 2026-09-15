"""登录限流器跨重启持久化测试。

覆盖：
- record_failure 写穿 DB，新实例 load_from_db 后仍锁定（模拟重启恢复）
- record_success 清 DB，load_from_db 后解锁
- 过期行加载时被过滤
- persist=True 但 DB 写失败时不崩溃（降级纯内存）
- 默认 persist=False 不写 DB（保持纯内存单测语义）
"""
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.rate_limiter import LoginRateLimiter
from app.db import login_failure_dao


@pytest.fixture(autouse=True)
def _clean_db():
    login_failure_dao.clear_all()
    yield
    login_failure_dao.clear_all()


def _locked(mgr, username, ip):
    return not mgr.is_allowed(username, ip)


def test_record_failure_persists_across_restart():
    """失败写穿 DB，新实例 load_from_db 后仍锁定（模拟重启恢复）"""
    lim = LoginRateLimiter(max_failures=2, persist=True)
    lim.record_failure("alice", "1.1.1.1")
    lim.record_failure("alice", "1.1.1.1")
    assert _locked(lim, "alice", "1.1.1.1")

    # 模拟重启：全新实例（不共享内存），从 DB 加载
    restored = LoginRateLimiter(max_failures=2, persist=True)
    assert restored.is_allowed("alice", "1.1.1.1") is True  # 未加载前无状态
    restored.load_from_db()
    assert _locked(restored, "alice", "1.1.1.1") is True
    # 恢复后失败计数正确（验证码阈值判断依赖它）
    assert restored.failure_count("alice", "1.1.1.1") == 2


def test_record_success_clears_persistence():
    """成功登录清零并同步删 DB，重启后不再锁定"""
    lim = LoginRateLimiter(max_failures=2, persist=True)
    lim.record_failure("bob", "2.2.2.2")
    lim.record_failure("bob", "2.2.2.2")
    lim.record_success("bob", "2.2.2.2")

    restored = LoginRateLimiter(max_failures=2, persist=True)
    restored.load_from_db()
    assert restored.is_allowed("bob", "2.2.2.2") is True
    assert restored.failure_count("bob", "2.2.2.2") == 0


def test_expired_rows_filtered_on_load():
    """过期行加载时被过滤，重启后自动解锁"""
    lim = LoginRateLimiter(max_failures=2, lock_seconds=1, persist=True)
    lim.record_failure("carol", "3.3.3.3")
    lim.record_failure("carol", "3.3.3.3")
    time.sleep(1.1)

    restored = LoginRateLimiter(max_failures=2, persist=True)
    restored.load_from_db()
    assert restored.is_allowed("carol", "3.3.3.3") is True


def test_db_write_failure_degrades_gracefully(monkeypatch):
    """DB 写失败不崩溃，仅内存生效（降级）"""
    lim = LoginRateLimiter(max_failures=2, persist=True)
    monkeypatch.setattr(login_failure_dao, "increment", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("db down")))
    # 不应抛异常
    lim.record_failure("dave", "4.4.4.4")
    # 内存侧仍生效
    assert lim.failure_count("dave", "4.4.4.4") == 1


def test_db_success_write_failure_degrades_gracefully(monkeypatch):
    """清零写 DB 失败也不崩溃"""
    lim = LoginRateLimiter(max_failures=2, persist=True)
    lim.record_failure("erin", "5.5.5.5")
    monkeypatch.setattr(login_failure_dao, "reset", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("db down")))
    lim.record_success("erin", "5.5.5.5")  # 不应抛异常
    assert lim.failure_count("erin", "5.5.5.5") == 0  # 内存已清零


def test_default_not_persisted():
    """默认 persist=False 不写 DB"""
    lim = LoginRateLimiter(max_failures=2)  # persist 默认 False
    lim.record_failure("frank", "6.6.6.6")
    # DB 里不应有记录
    restored = LoginRateLimiter(max_failures=2, persist=True)
    restored.load_from_db()
    assert restored.failure_count("frank", "6.6.6.6") == 0


def test_load_from_db_ignored_when_not_persist():
    """persist=False 时 load_from_db 不加载（空操作）"""
    lim = LoginRateLimiter(max_failures=2)
    lim.record_failure("grace", "7.7.7.7")  # 不写 DB
    lim2 = LoginRateLimiter(max_failures=2)
    lim2.load_from_db()  # persist=False -> 直接 return
    assert lim2.failure_count("grace", "7.7.7.7") == 0


def test_concurrent_increment_no_lost_update():
    """并发 record_failure 后 DB 计数与内存一致（原子 upsert，无丢失更新/UNIQUE 冲突）"""
    login_failure_dao.clear_all()
    lim = LoginRateLimiter(max_failures=10000, persist=True)
    n = 40
    with ThreadPoolExecutor(max_workers=16) as ex:
        list(ex.map(lambda _: lim.record_failure("conc", "9.9.9.9"), range(n)))
    # 内存侧（权威）应等于 n
    assert lim.failure_count("conc", "9.9.9.9") == n
    # DB 侧也应等于 n（原子 upsert，无丢失更新）
    records = login_failure_dao.load_all()
    assert records.get(("conc", "9.9.9.9"))[0] == n
