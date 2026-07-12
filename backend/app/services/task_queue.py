"""任务队列管理器 — 控制并发执行数，超出的任务 FIFO 排队。

线程安全设计（公网多用户并发加固）：
- 所有公开方法用 `threading.RLock` 保护，防止 check-then-act 竞态导致并发数失控
- 磁盘 IO（_write_queued_status）移出临界区，锁内只收集待写列表，锁外批量写
- 心跳机制：任务执行期间通过 update_heartbeat 上报存活，看门狗据此清理卡死任务
- release 幂等化：防止看门狗先释放、卡死线程后释放导致重复拉起
"""
import os
import json
import time
import threading
from collections import deque

from app.utils.logger import get_logger

logger = get_logger(__name__)

# 使用统一的路径管理工具
from app.utils.path_helper import VIDEO_DIR


class TaskQueueManager:
    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls):
        # 双重检查锁，保证单例创建本身线程安全
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._lock = threading.RLock()  # RLock 允许同线程内嵌套加锁（如 cancel→remove→release）
        self.max_concurrent = int(os.getenv("MAX_CONCURRENT_TASKS", "3"))
        self.running_tasks: set[str] = set()
        self.queued_tasks: deque[str] = deque()
        self.cancelled_tasks: set[str] = set()
        # 心跳 & 开始时间追踪（看门狗据此检测卡死任务）
        self._task_heartbeats: dict[str, float] = {}
        self._task_start_times: dict[str, float] = {}
        # 任务启动回调（从队列拉起任务时调用）
        self._start_callback = None
        logger.info(f"TaskQueueManager 初始化，最大并发数: {self.max_concurrent}")

    def acquire(self, task_id: str) -> bool:
        """尝试获取执行槽位。成功返回 True，失败则入队返回 False。"""
        with self._lock:
            if len(self.running_tasks) < self.max_concurrent:
                self.running_tasks.add(task_id)
                now = time.time()
                self._task_start_times[task_id] = now
                self._task_heartbeats[task_id] = now
                logger.info(f"任务 {task_id} 获取执行槽位 ({len(self.running_tasks)}/{self.max_concurrent})")
                return True

            self.queued_tasks.append(task_id)
            position = len(self.queued_tasks)

        # 磁盘 IO 在锁外执行，不阻塞其他 acquire/release
        self._write_queued_status(task_id, position)
        logger.info(f"任务 {task_id} 进入排队 ({position} 位)")
        return False

    def release(self, task_id: str):
        """释放执行槽位，自动从队列取下一个执行。返回下一个 task_id 或 None。

        幂等设计：如果 task_id 不在 running_tasks 中（已被看门狗先释放），
        直接返回 None，防止重复拉起下一个任务。
        """
        with self._lock:
            # 幂等：看门狗可能已经释放过这个任务
            if task_id not in self.running_tasks:
                logger.warning(f"任务 {task_id} 不在运行中（可能已被释放），跳过")
                return None

            self.running_tasks.discard(task_id)
            self._task_heartbeats.pop(task_id, None)
            self._task_start_times.pop(task_id, None)
            logger.info(f"任务 {task_id} 释放槽位 ({len(self.running_tasks)}/{self.max_concurrent})")

            if not self.queued_tasks:
                return None

            next_task_id = self.queued_tasks.popleft()
            # 收集需要更新排队位置的任务，锁外写磁盘
            updates = [(tid, i + 1) for i, tid in enumerate(self.queued_tasks)]

        for tid, pos in updates:
            self._write_queued_status(tid, pos)

        return next_task_id

    def remove(self, task_id: str):
        """从队列中移除指定任务（用于取消/删除任务）"""
        with self._lock:
            self.running_tasks.discard(task_id)
            self._task_heartbeats.pop(task_id, None)
            self._task_start_times.pop(task_id, None)
            try:
                self.queued_tasks.remove(task_id)
                updates = [(tid, i + 1) for i, tid in enumerate(self.queued_tasks)]
            except ValueError:
                updates = []  # 任务不在排队队列中

        for tid, pos in updates:
            self._write_queued_status(tid, pos)
        logger.info(f"任务 {task_id} 已从队列中移除")

    def cancel(self, task_id: str):
        """取消任务：标记为已取消 + 从队列移除"""
        with self._lock:
            self.cancelled_tasks.add(task_id)
        self.remove(task_id)
        logger.info(f"任务 {task_id} 已标记为取消")

    def is_cancelled(self, task_id: str) -> bool:
        """检查任务是否已被取消"""
        with self._lock:
            return task_id in self.cancelled_tasks

    def clear_cancelled(self, task_id: str):
        """清除取消标记（用于任务完成后清理）"""
        with self._lock:
            self.cancelled_tasks.discard(task_id)

    def update_heartbeat(self, task_id: str):
        """更新任务心跳时间（表示任务仍在活跃执行）。

        由 NoteGenerator._check_cancelled 在每个阶段切换点调用。
        看门狗据此判断任务是否卡死。
        """
        with self._lock:
            if task_id in self.running_tasks:
                self._task_heartbeats[task_id] = time.time()

    def get_stale_tasks(self, timeout_seconds: int = 900) -> list[str]:
        """返回心跳超时的运行中任务列表（供看门狗处理）。

        默认 15 分钟（900 秒）无心跳视为卡死。
        """
        now = time.time()
        with self._lock:
            return [
                tid for tid in self.running_tasks
                if now - self._task_heartbeats.get(tid, now) > timeout_seconds
            ]

    def get_queue_position(self, task_id: str) -> int:
        """获取排队位置，0 表示执行中，-1 表示不在队列中。"""
        with self._lock:
            if task_id in self.running_tasks:
                return 0
            try:
                return list(self.queued_tasks).index(task_id) + 1
            except ValueError:
                return -1

    def get_status(self) -> dict:
        """返回当前队列状态。"""
        with self._lock:
            return {
                "running": len(self.running_tasks),
                "max_concurrent": self.max_concurrent,
                "queued": len(self.queued_tasks),
                "running_tasks": list(self.running_tasks),
                "queued_tasks": list(self.queued_tasks),
            }

    def update_max_concurrent(self, n: int):
        """更新最大并发数。"""
        n = max(1, min(10, n))
        with self._lock:
            old = self.max_concurrent
            self.max_concurrent = n
            logger.info(f"最大并发数更新: {old} -> {n}")

            # 如果新的上限大于当前并发数，收集需要拉起的任务
            to_start = []
            updates = []
            while len(self.running_tasks) < self.max_concurrent and self.queued_tasks:
                next_task_id = self.queued_tasks.popleft()
                self.running_tasks.add(next_task_id)
                now = time.time()
                self._task_start_times[next_task_id] = now
                self._task_heartbeats[next_task_id] = now
                to_start.append(next_task_id)
                updates = [(tid, i + 1) for i, tid in enumerate(self.queued_tasks)]

        # 锁外执行磁盘 IO 和任务启动回调（_start_callback 会开新线程，本身不阻塞）
        for tid, pos in updates:
            self._write_queued_status(tid, pos)
        for tid in to_start:
            self._start_queued_task(tid)

    def _write_queued_status(self, task_id: str, position: int):
        """写入排队状态文件到 _pending 临时目录。"""
        pending_dir = VIDEO_DIR / "_pending" / task_id
        pending_dir.mkdir(parents=True, exist_ok=True)
        status_path = pending_dir / "status.json"
        status_data = {
            "status": "QUEUED",
            "message": f"排队中（第 {position} 位）",
            "queue_position": position,
        }
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False)

    def _start_queued_task(self, task_id: str):
        """拉起排队的任务（需在子类或外部注册启动回调）。"""
        logger.info(f"排队任务 {task_id} 被拉起执行")
        if self._start_callback:
            self._start_callback(task_id)

    def register_start_callback(self, callback):
        """注册任务启动回调，用于从队列拉起任务时调用。"""
        self._start_callback = callback


# 全局单例
task_queue = TaskQueueManager()
