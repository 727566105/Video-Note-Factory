"""MCP 限流器

按 user_id 分级限流，防止 API Key 泄露后被恶意调用耗尽资源。
内存滑动窗口实现（collections.deque），适合 20-100 人规模。

分级：
- 重操作（import_video 等）：5 次/分钟
- 轻操作（list_notes 等）：60 次/分钟
"""
import time
import threading
from collections import deque
from typing import Optional

from app.utils.logger import get_logger

logger = get_logger(__name__)

# 限流配置
HEAVY_LIMIT = 5      # 重操作每分钟次数
LIGHT_LIMIT = 60     # 轻操作每分钟次数
WINDOW_SECONDS = 60  # 滑动窗口大小（秒）
STALE_CLEANUP_SECONDS = 600  # 超过 10 分钟无请求的条目清理

# 重操作集合（按 tool 名称判断）
_HEAVY_TOOLS = {
    "import_video",
    "generate_from_feed",
    "refresh_subscription",
    "refresh_feed",
    "add_subscription",
    "generate_summary",
}

# 每用户的限流状态：{user_id: {"heavy": deque, "light": deque, "last": float}}
_user_limits: dict[int, dict] = {}
_lock = threading.Lock()


def _is_heavy(tool_name: str) -> bool:
    """判断是否重操作"""
    return tool_name in _HEAVY_TOOLS


def check_rate_limit(user_id: int, tool_name: str) -> tuple[bool, int]:
    """检查是否允许调用。

    Args:
        user_id: 用户 ID
        tool_name: MCP tool 名称

    Returns:
        (allowed, retry_after_seconds)
        allowed=True 表示放行，retry_after=0
        allowed=False 表示被限流，retry_after=建议等待秒数
    """
    now = time.monotonic()
    category = "heavy" if _is_heavy(tool_name) else "light"
    limit = HEAVY_LIMIT if category == "heavy" else LIGHT_LIMIT

    with _lock:
        # 获取或创建用户限流状态
        if user_id not in _user_limits:
            _user_limits[user_id] = {
                "heavy": deque(),
                "light": deque(),
                "last": now,
            }

        state = _user_limits[user_id]
        state["last"] = now
        dq = state[category]

        # 清理窗口外的旧时间戳
        cutoff = now - WINDOW_SECONDS
        while dq and dq[0] < cutoff:
            dq.popleft()

        # 检查是否超限
        if len(dq) >= limit:
            # 计算最早记录到现在的差值，推算还需等待多久
            oldest = dq[0]
            retry_after = int(oldest + WINDOW_SECONDS - now) + 1
            logger.warning(
                f"MCP 限流: user_id={user_id} tool={tool_name} "
                f"category={category} count={len(dq)}/{limit} retry_after={retry_after}s"
            )
            return False, max(retry_after, 1)

        # 放行，记录本次请求时间
        dq.append(now)
        return True, 0


def cleanup_stale_entries():
    """清理长时间无请求的用户条目（防止内存泄漏）。

    在每次限流检查时惰性调用即可，无需定时器。
    """
    now = time.monotonic()
    with _lock:
        stale = [
            uid for uid, state in _user_limits.items()
            if now - state["last"] > STALE_CLEANUP_SECONDS
        ]
        for uid in stale:
            del _user_limits[uid]
        if stale:
            logger.info(f"MCP 限流器清理 {len(stale)} 个过期用户条目")


def reset_rate_limit(user_id: Optional[int] = None):
    """重置限流状态（测试用）"""
    with _lock:
        if user_id is not None:
            _user_limits.pop(user_id, None)
        else:
            _user_limits.clear()
