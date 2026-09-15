"""串行频道获取队列 — 严格串行处理，防止 API 封禁"""
import os
import time
import threading
import logging
from collections import deque
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# 分页间隔秒数（从环境变量读取）
BILIBILI_PAGE_INTERVAL = int(os.getenv("BILIBILI_PAGE_INTERVAL", "10"))
# 每批数量（B站 API 每页最多 50，实际返回约 30）
BATCH_SIZE = 30

# 平台频道 URL 模板
CHANNEL_URL_TEMPLATES = {
    "bilibili": "https://space.bilibili.com/{platform_id}",
    "youtube": "https://www.youtube.com/channel/{platform_id}",
    "douyin": "https://www.douyin.com/user/{platform_id}",
}


@dataclass
class FetchTask:
    """队列任务"""
    platform: str
    platform_id: str
    user_id: int
    subscription_id: int


class ChannelFetchQueue:
    """串行频道获取队列（单例）"""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._queue = deque()
                    cls._instance._processing = False
                    cls._instance._thread = None
        return cls._instance

    def enqueue(self, platform: str, platform_id: str,
                user_id: int, subscription_id: int) -> dict:
        """加入队列，已在队列中则跳过"""
        # 检查重复
        for task in self._queue:
            if task.platform == platform and task.platform_id == platform_id:
                logger.info(f"任务已在队列中: {platform}/{platform_id}")
                return {"queued": True, "message": "已在队列中", "already_queued": True}

        task = FetchTask(
            platform=platform,
            platform_id=platform_id,
            user_id=user_id,
            subscription_id=subscription_id,
        )
        self._queue.append(task)
        logger.info(f"任务已加入队列: {platform}/{platform_id}, 当前队列长度={len(self._queue)}")

        if not self._processing:
            self._start_processing()

        return {"queued": True, "message": "已加入队列", "already_queued": False}

    def get_queue_length(self) -> int:
        """返回队列长度"""
        return len(self._queue)

    def is_processing(self) -> bool:
        """是否正在处理"""
        return self._processing

    def _start_processing(self):
        """启动后台处理线程"""
        if self._processing:
            return
        self._processing = True
        self._thread = threading.Thread(target=self._process_loop, daemon=True)
        self._thread.start()
        logger.info("后台处理线程已启动")

    def _process_loop(self):
        """串行处理所有任务"""
        logger.info("处理循环开始，队列长度=%d", len(self._queue))

        while self._queue:
            task = self._queue.popleft()
            logger.info(f"开始处理任务: {task.platform}/{task.platform_id}")
            try:
                self._fetch_batch(task)
            except Exception as e:
                logger.error(f"频道获取失败: {task.platform}/{task.platform_id}, error={e}")
                self._update_status_error(task, str(e))

            # 任务完成后等待间隔
            if self._queue:
                logger.info(f"等待 {BILIBILI_PAGE_INTERVAL} 秒后处理下一个任务")
                time.sleep(BILIBILI_PAGE_INTERVAL)

        self._processing = False
        logger.info("处理循环结束，队列已清空")

    def _update_status_error(self, task: FetchTask, error_msg: str):
        """更新状态为 error"""
        from app.db.channel_video_dao import update_fetch_status
        try:
            update_fetch_status(
                task.platform, task.platform_id,
                fetch_status="error", error_message=error_msg,
            )
        except Exception as e:
            logger.error(f"更新状态失败: {e}")

    def _build_channel_url(self, platform: str, platform_id: str) -> Optional[str]:
        """根据 platform_id 构造频道 URL"""
        template = CHANNEL_URL_TEMPLATES.get(platform)
        if template:
            return template.format(platform_id=platform_id)
        logger.warning(f"未知平台: {platform}, 无法构造频道 URL")
        return None

    def _fetch_batch(self, task: FetchTask):
        """获取一批视频"""
        from app.db.channel_video_dao import (
            get_or_create_fetch_status,
            update_fetch_status,
            upsert_channel_videos,
            count_channel_videos,
        )
        from app.db.subscription_dao import create_feed_items_from_channel_videos
        from app.services.channel_fetcher import fetch_videos, FetchResult
        from app.services.douyin_api import fetch_douyin_user_videos, DouyinFetchResult

        # 获取或创建状态记录
        status = get_or_create_fetch_status(task.platform, task.platform_id)

        if status.fetch_status == "complete":
            logger.info(f"频道已全部获取完成: {task.platform}/{task.platform_id}")
            return

        # 更新状态为 partial
        update_fetch_status(task.platform, task.platform_id, fetch_status="partial")

        # 构造频道 URL
        channel_url = self._build_channel_url(task.platform, task.platform_id)
        if not channel_url:
            update_fetch_status(
                task.platform, task.platform_id,
                fetch_status="error", error_message="无法构造频道 URL",
            )
            return

        # 抖音分支：定时刷新只拉最新35条，历史回溯由 subscription_scheduler 游标分页完成
        if task.platform == "douyin":
            result: DouyinFetchResult = fetch_douyin_user_videos(
                sec_uid=task.platform_id,
                max_cursor=0,
                count=35,
                max_pages=1,
            )

            if result.error:
                logger.error(f"抖音 fetch 失败: {result.error}")
                update_fetch_status(
                    task.platform, task.platform_id,
                    fetch_status="error", error_message=result.error,
                )
                return

            videos = result.items
            if not videos:
                logger.info(f"抖音本页无视频，标记为 complete: {task.platform}/{task.platform_id}")
                update_fetch_status(task.platform, task.platform_id, fetch_status="complete")
                return

            # upsert 到共享表
            logger.info(f"抖音 upsert_channel_videos: count={len(videos)}")
            channel_video_records = upsert_channel_videos(videos, task.platform, task.platform_id)

            # 更新状态
            current_count = count_channel_videos(task.platform, task.platform_id)
            is_complete = not result.has_more

            update_fetch_status(
                task.platform, task.platform_id,
                total_videos=max(status.total_videos, current_count),
                fetched_count=current_count,
                next_cursor=str(result.next_cursor) if result.next_cursor else "0",
                fetch_status="complete" if is_complete else "partial",
            )

            # 为触发用户创建 feed_items
            create_feed_items_from_channel_videos(
                user_id=task.user_id,
                subscription_id=task.subscription_id,
                channel_videos=channel_video_records,
                platform=task.platform,
            )

            logger.info(f"抖音批次获取完成: {task.platform}/{task.platform_id}, "
                        f"本批={len(videos)}, 累计={current_count}, cursor={result.next_cursor}, complete={is_complete}")
            return

        # B站和其他平台分支
        logger.info(f"调用 fetch_videos: channel_url={channel_url}, page_limit=1")
        result: FetchResult = fetch_videos(
            channel_url=channel_url,
            platform=task.platform,
            limit=None,
            page_limit=1,
        )

        if result.error:
            logger.error(f"fetch_videos 失败: {result.error}")
            update_fetch_status(
                task.platform, task.platform_id,
                fetch_status="error", error_message=result.error,
            )
            return

        videos = result.items
        if not videos:
            logger.info(f"本页无视频，标记为 complete: {task.platform}/{task.platform_id}")
            update_fetch_status(task.platform, task.platform_id, fetch_status="complete")
            return

        # upsert 到共享表
        logger.info(f"upsert_channel_videos: count={len(videos)}")
        channel_video_records = upsert_channel_videos(videos, task.platform, task.platform_id)

        # 更新状态
        current_count = count_channel_videos(task.platform, task.platform_id)
        next_page = status.next_page + 1

        # 判断是否最后一页（本页数量少于 BATCH_SIZE 说明最后一页）
        is_complete = len(videos) < BATCH_SIZE

        update_fetch_status(
            task.platform, task.platform_id,
            total_videos=max(status.total_videos, current_count),
            fetched_count=current_count,
            next_page=next_page,
            fetch_status="complete" if is_complete else "partial",
        )

        # 为触发用户创建 feed_items
        create_feed_items_from_channel_videos(
            user_id=task.user_id,
            subscription_id=task.subscription_id,
            channel_videos=channel_video_records,
            platform=task.platform,
        )

        logger.info(f"批次获取完成: {task.platform}/{task.platform_id}, "
                    f"本批={len(videos)}, 累计={current_count}, complete={is_complete}")


# 全局单例导出
channel_fetch_queue = ChannelFetchQueue()