"""登录失败记录的持久化 DAO（跨重启防暴力破解）。

`LoginRateLimiter` 默认纯内存；全局单例开启持久化后，失败/清零会写穿到
`login_failures` 表，重启时 `load_from_db()` 恢复锁定状态。
时间统一存 naive UTC。
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

from app.db.engine import get_db
from app.db.models.login_failure import LoginFailure
from app.utils.logger import get_logger

logger = get_logger(__name__)

# (username, client_ip) -> (failure_count, locked_until: aware datetime | None)
FailureMap = Dict[Tuple[str, str], Tuple[int, Optional[datetime]]]


def _to_naive_utc(dt: datetime) -> datetime:
    """转成 naive UTC 存储（SQLite 不保留时区）。"""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _to_aware_utc(dt: datetime) -> datetime:
    """把 naive UTC 读回 aware UTC。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def load_all(now: Optional[datetime] = None) -> FailureMap:
    """加载所有未过期的失败记录。

    过期（locked_until <= now）的行在返回时被过滤，并顺手从库中删除（惰性清理）。
    """
    now = now or datetime.now(timezone.utc)
    db = next(get_db())
    try:
        rows = db.query(LoginFailure).all()
        result: FailureMap = {}
        expired: list[LoginFailure] = []
        for row in rows:
            if row.locked_until is None:
                continue
            locked_until = _to_aware_utc(row.locked_until)
            if locked_until <= now:
                expired.append(row)
                continue
            result[(row.username, row.client_ip)] = (
                row.failure_count,
                locked_until,
            )
        for row in expired:
            db.delete(row)
        if expired:
            db.commit()
        return result
    except Exception as e:
        logger.error(f"加载登录失败记录失败: {e}")
        return {}
    finally:
        db.close()


def increment(username: str, client_ip: str, count: int, locked_until: datetime) -> None:
    """upsert 一条失败记录（有则更新，无则插入）。"""
    db = next(get_db())
    try:
        row = (
            db.query(LoginFailure)
            .filter_by(username=username, client_ip=client_ip)
            .first()
        )
        if row is None:
            row = LoginFailure(username=username, client_ip=client_ip)
            db.add(row)
        row.failure_count = count
        row.locked_until = _to_naive_utc(locked_until)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"写入登录失败记录失败 (user={username}): {e}")
        raise
    finally:
        db.close()


def reset(username: str, client_ip: str) -> None:
    """删除一条失败记录（成功登录清零）。"""
    db = next(get_db())
    try:
        row = (
            db.query(LoginFailure)
            .filter_by(username=username, client_ip=client_ip)
            .first()
        )
        if row is not None:
            db.delete(row)
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"清除登录失败记录失败 (user={username}): {e}")
        raise
    finally:
        db.close()


def clear_all() -> None:
    """清空所有失败记录（测试隔离用）。"""
    db = next(get_db())
    try:
        db.query(LoginFailure).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"清空登录失败记录失败: {e}")
        raise
    finally:
        db.close()
