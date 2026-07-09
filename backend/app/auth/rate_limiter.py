from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, Tuple


class LoginRateLimiter:
    """简单的内存登录失败限流器。"""

    def __init__(self, max_failures: int = 5, lock_seconds: int = 600):
        self.max_failures = max_failures
        self.lock_seconds = lock_seconds
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
            self._failures[key] = (count, now + timedelta(seconds=self.lock_seconds))

    def record_success(self, username: str, client_ip: str) -> None:
        with self._lock:
            self._failures.pop(self._key(username, client_ip), None)


login_rate_limiter = LoginRateLimiter()
