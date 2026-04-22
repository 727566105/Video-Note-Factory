"""任务队列管理器 — 控制并发执行数，超出的任务 FIFO 排队"""
import os
import json
import logging
from collections import deque
from typing import Optional

from app.utils.logger import get_logger

logger = get_logger(__name__)

NOTE_OUTPUT_DIR = os.getenv("NOTE_OUTPUT_DIR", "note_results")


class TaskQueueManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.max_concurrent = int(os.getenv("MAX_CONCURRENT_TASKS", "3"))
        self.running_tasks: set[str] = set()
        self.queued_tasks: deque[str] = deque()
        logger.info(f"TaskQueueManager 初始化，最大并发数: {self.max_concurrent}")

    def acquire(self, task_id: str) -> bool:
        """尝试获取执行槽位。成功返回 True，失败则入队返回 False。"""
        if len(self.running_tasks) < self.max_concurrent:
            self.running_tasks.add(task_id)
            logger.info(f"任务 {task_id} 获取执行槽位 ({len(self.running_tasks)}/{self.max_concurrent})")
            return True

        self.queued_tasks.append(task_id)
        position = len(self.queued_tasks)
        self._write_queued_status(task_id, position)
        logger.info(f"任务 {task_id} 进入排队 ({position} 位)")
        return False

    def release(self, task_id: str):
        """释放执行槽位，自动从队列取下一个执行。返回下一个 task_id 或 None。"""
        self.running_tasks.discard(task_id)
        logger.info(f"任务 {task_id} 释放槽位 ({len(self.running_tasks)}/{self.max_concurrent})")

        if not self.queued_tasks:
            return None

        next_task_id = self.queued_tasks.popleft()
        # 更新队列中剩余任务的排队位置
        for i, tid in enumerate(self.queued_tasks):
            self._write_queued_status(tid, i + 1)

        return next_task_id

    def remove(self, task_id: str):
        """从队列中移除指定任务（用于取消/删除任务）"""
        self.running_tasks.discard(task_id)
        try:
            self.queued_tasks.remove(task_id)
            # 更新队列中剩余任务的排队位置
            for i, tid in enumerate(self.queued_tasks):
                self._write_queued_status(tid, i + 1)
        except ValueError:
            pass  # 任务不在排队队列中
        logger.info(f"任务 {task_id} 已从队列中移除")

    def get_queue_position(self, task_id: str) -> int:
        """获取排队位置，0 表示执行中，-1 表示不在队列中。"""
        if task_id in self.running_tasks:
            return 0
        try:
            return list(self.queued_tasks).index(task_id) + 1
        except ValueError:
            return -1

    def get_status(self) -> dict:
        """返回当前队列状态。"""
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
        old = self.max_concurrent
        self.max_concurrent = n
        logger.info(f"最大并发数更新: {old} -> {n}")

        # 如果新的上限大于当前并发数，尝试拉起排队任务
        while len(self.running_tasks) < self.max_concurrent and self.queued_tasks:
            next_task_id = self.queued_tasks.popleft()
            self.running_tasks.add(next_task_id)
            # 更新队列中剩余任务的排队位置
            for i, tid in enumerate(self.queued_tasks):
                self._write_queued_status(tid, i + 1)
            # 触发排队任务开始执行
            self._start_queued_task(next_task_id)

    def _write_queued_status(self, task_id: str, position: int):
        """写入排队状态文件。"""
        os.makedirs(NOTE_OUTPUT_DIR, exist_ok=True)
        status_path = os.path.join(NOTE_OUTPUT_DIR, f"{task_id}.status.json")
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
        # 实际启动逻辑通过回调注入，见 register_start_callback
        if hasattr(self, '_start_callback') and self._start_callback:
            self._start_callback(task_id)

    def register_start_callback(self, callback):
        """注册任务启动回调，用于从队列拉起任务时调用。"""
        self._start_callback = callback


# 全局单例
task_queue = TaskQueueManager()
