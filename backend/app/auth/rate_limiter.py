from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, Optional, Tuple

from app.utils.logger import get_logger

logger = get_logger(__name__)


class LoginRateLimiter:
    """登录失败限流器。

    默认纯内存（`persist=False`），供单测/快速路径使用；全局单例开启
    `persist=True` 后，失败/清零会写穿到 `login_failures` 表，并在重启时
    `load_from_db()` 恢复锁定状态（防通过重启绕过暴力破解防护）。
    DB 写失败只记日志、不阻断登录（降级回纯内存）。
    """

    def __init__(self, max_failures: int = 5, lock_seconds: int = 600, persist: bool = False):
        self.max_failures = max_failures
        self.lock_seconds = lock_seconds
        self.persist = persist
        self._failures: Dict[Tuple[str, str], tuple[int, datetime]] = {}
        self._lock = Lock()

    def _key(self, username: str, client_ip: str) -> Tuple[str, str]:
        return ((username or "").strip().lower(), client_ip or "unknown")

    def is_allowed(self, username: str, client_ip: str) -> bool:
        key = self._key(username, client_ip)
        now = datetime.now(timezone.utc)
        with self._lock:
            entry = self._failures.get(key)
            if not entry:
                return True
            count, locked_until = entry
            if locked_until <= now:
                self._failures.pop(key, None)
                return True
            return count < self.max_failures

    def record_failure(self, username: str, client_ip: str) -> None:
        key = self._key(username, client_ip)
        now = datetime.now(timezone.utc)
        with self._lock:
            count, locked_until = self._failures.get(key, (0, now))
            if locked_until <= now:
                count = 0
            count += 1
            locked_until = now + timedelta(seconds=self.lock_seconds)
            self._failures[key] = (count, locked_until)

        if self.persist:
            try:
                from app.db.login_failure_dao import increment

                increment(username, client_ip, count, locked_until)
            except Exception as e:
                logger.error(f"登录失败记录写穿 DB 失败（仅内存生效）: {e}")

    def failure_count(self, username: str, client_ip: str) -> int:
        """返回当前失败次数（用于判断是否需图形验证码），0 表示无记录。"""
        key = self._key(username, client_ip)
        now = datetime.now(timezone.utc)
        with self._lock:
            entry = self._failures.get(key)
            if not entry:
                return 0
            count, locked_until = entry
            if locked_until <= now:
                self._failures.pop(key, None)
                return 0
            return count

    def record_success(self, username: str, client_ip: str) -> None:
        with self._lock:
            self._failures.pop(self._key(username, client_ip), None)

        if self.persist:
            try:
                from app.db.login_failure_dao import reset

                reset(username, client_ip)
            except Exception as e:
                logger.error(f"登录失败记录清零写穿 DB 失败: {e}")

    def load_from_db(self) -> None:
        """从 DB 加载未过期失败记录（启动时调用，恢复上次进程的锁定状态）。"""
        if not self.persist:
            return
        try:
            from app.db.login_failure_dao import load_all

            records = load_all()
            with self._lock:
                self._failures.clear()
                for (username, client_ip), (count, locked_until) in records.items():
                    self._failures[(username, client_ip)] = (count, locked_until)
            if records:
                logger.info(f"已从 DB 恢复 {len(records)} 条登录失败记录")
        except Exception as e:
            logger.error(f"从 DB 加载登录失败记录失败: {e}")


login_rate_limiter = LoginRateLimiter(persist=True)
