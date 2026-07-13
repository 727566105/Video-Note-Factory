import os
import tempfile
import requests as http_requests
from abc import ABC
from typing import Union, Optional

import yt_dlp

from app.downloaders.base import Downloader, DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult
from app.utils.url_parser import extract_video_id
from app.utils.logger import get_logger
from app.services.cookie_manager import CookieConfigManager

logger = get_logger(__name__)

YOUTUBE_COOKIE_ERROR_MSG = "YouTube Cookie 缺失或过期，请在设置中配置有效的 YouTube Cookie。获取方法：登录 youtube.com → F12 → Application → Cookies → 导出所有 Cookie"

cfm = CookieConfigManager()


class YoutubeDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def _write_cookiefile(self) -> Optional[str]:
        """将 cookie 写入临时 Netscape 格式文件，返回文件路径"""
        cookie_str = cfm.get("youtube")
        if not cookie_str:
            return None

        lines = ["# Netscape HTTP Cookie File\n"]
        for item in cookie_str.split(';'):
            item = item.strip()
            if '=' in item:
                name, value = item.split('=', 1)
                lines.append(f".youtube.com\tTRUE\t/\tTRUE\t0\t{name.strip()}\t{value.strip()}\n")

        cookiefile = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        cookiefile.write(''.join(lines))
        cookiefile.close()
        return cookiefile.name

    def _cleanup_cookiefile(self, cookiefile: Optional[str]):
        """清理临时 cookie 文件"""
        if cookiefile and os.path.exists(cookiefile):
            try:
                os.remove(cookiefile)
            except Exception as e:
                logger.warning(f"清理临时 cookie 文件失败: {e}")

    def _is_community_post_url(self, video_url: str) -> bool:
        """检测是否为 YouTube 社区帖子链接"""
        return '/post/' in video_url or '/community' in video_url or 'lb=' in video_url

    def _get_community_post_info(self, video_url: str) -> VideoInfoResult:
        """获取 YouTube 社区帖子元数据（图文内容）

        YouTube 社区帖子需要 InnerTube API 获取，
        目前返回基本信息让上游走图文流程，正文内容由用户在笔记中编辑。
        """
        # 提取 post_id
        import re
        match = re.search(r'/post/(.+?)(?:\?|$)', video_url)
        post_id = match.group(1) if match else video_url[-20:]

        return VideoInfoResult(
            title=f"YouTube 帖子 {post_id[:12]}",
            duration=0,
            cover_url=None,
            platform="youtube",
            video_id=f"post_{post_id}",
            author_id=None,
            author_name="YouTube",
            description="YouTube 社区帖子内容（需要手动编辑或后续支持 InnerTube API）",
            content_type="article",
            raw_info={"post_id": post_id, "url": video_url},
        )

    def _download_community_post(self, video_url: str, output_dir: str) -> AudioDownloadResult:
        """下载 YouTube 社区帖子（图文）

        YouTube 社区帖子不提供直接的图片下载 API，
        返回 article 类型让上游走图文笔记流程，用户可在笔记中手动补充。
        """
        import re
        match = re.search(r'/post/(.+?)(?:\?|$)', video_url)
        post_id = match.group(1) if match else video_url[-20:]

        return AudioDownloadResult(
            file_path=None,
            title=f"YouTube 帖子 {post_id[:12]}",
            duration=0,
            cover_url=None,
            platform="youtube",
            video_id=f"post_{post_id}",
            description="YouTube 社区帖子内容（需要手动编辑）",
            content_type="article",
            images=[],
            tags=[],
            raw_info={"post_id": post_id, "url": video_url},
        )

    def download(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
        quality: DownloadQuality = "fast",
        need_video:Optional[bool]=False
    ) -> AudioDownloadResult:
        if output_dir is None:
            raise ValueError("output_dir 不能为空，必须传入三级目录路径")
        os.makedirs(output_dir, exist_ok=True)

        # 社区帖子走图文分支
        if self._is_community_post_url(video_url):
            return self._download_community_post(video_url, output_dir)

        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        cookiefile = self._write_cookiefile()
        try:
            ydl_opts = {
                'format': 'ba[ext=m4a]/ba[ext=webm]/ba/b',
                'outtmpl': output_path,
                'noplaylist': True,
                'quiet': False,
                'extractor_args': {'youtube': {'player_client': ['ios', 'android']}},
            }
            if cookiefile:
                ydl_opts['cookiefile'] = cookiefile

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                title = info.get("title")
                duration = info.get("duration", 0)
                cover_url = info.get("thumbnail")
                ext = info.get("ext", "m4a")
                audio_path = os.path.join(output_dir, f"{video_id}.{ext}")

            author_id = info.get("channel_id") or ""
            if cover_url and output_dir:
                try:
                    from app.utils.download_helper import DownloadHelper
                    temp_cover = DownloadHelper.download_file(
                        cover_url, output_dir, "_temp_cover.jpg",
                        referer="https://www.youtube.com/", timeout=10
                    )
                    if temp_cover:
                        from app.utils.video_helper import save_cover_to_video_dir
                        cover_url = save_cover_to_video_dir(
                            temp_cover, output_dir, "youtube", author_id, video_id
                        )
                        os.remove(temp_cover)
                    else:
                        # 下载失败：不保留远程 URL，避免依赖外部 CDN
                        logger.warning(f"YouTube 封面下载失败，丢弃远程 URL: {cover_url[:80]}")
                        cover_url = None
                except Exception as e:
                    logger.warning(f"YouTube 封面下载异常: {e}")
                    cover_url = None

            return AudioDownloadResult(
                file_path=audio_path,
                title=title,
                duration=duration,
                cover_url=cover_url,
                platform="youtube",
                video_id=video_id,
                raw_info={'tags':info.get('tags'), 'uploader': info.get('uploader') or info.get('channel', '')},
                video_path=None,
                description=info.get("description") or "",
                content_type="video",
                author_id=info.get("channel_id"),
                author_name=info.get("uploader") or info.get("channel") or None,
                tags=info.get("tags") or [],
            )
        except Exception as e:
            error_msg = str(e)
            if "Sign in to confirm you're not a bot" in error_msg or "cookies" in error_msg.lower():
                logger.error(YOUTUBE_COOKIE_ERROR_MSG)
                raise ValueError(YOUTUBE_COOKIE_ERROR_MSG) from e
            raise
        finally:
            self._cleanup_cookiefile(cookiefile)

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        # 社区帖子走图文分支
        if self._is_community_post_url(video_url):
            return self._get_community_post_info(video_url)
        cookiefile = self._write_cookiefile()
        try:
            ydl_opts = {
                'quiet': True,
                'noplaylist': True,
                'extractor_args': {'youtube': {'player_client': ['ios', 'android']}},
            }
            if cookiefile:
                ydl_opts['cookiefile'] = cookiefile
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)

            author_name = info.get("uploader") or info.get("channel") or ""
            return VideoInfoResult(
                title=info.get("title", ""),
                duration=info.get("duration", 0) or 0,
                cover_url=info.get("thumbnail"),
                platform="youtube",
                video_id=info.get("id", ""),
                author_id=info.get("channel_id"),
                author_name=author_name,
                description=info.get("description"),
                raw_info={
                    'tags': info.get('tags'),
                    'uploader': author_name,
                },
                content_type="video",
            )
        except Exception as e:
            error_msg = str(e)
            if "Sign in to confirm you're not a bot" in error_msg or "cookies" in error_msg.lower():
                logger.error(YOUTUBE_COOKIE_ERROR_MSG)
                raise ValueError(YOUTUBE_COOKIE_ERROR_MSG) from e
            raise
        finally:
            self._cleanup_cookiefile(cookiefile)

    def download_video(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
    ) -> str:
        """
        下载视频，返回视频文件路径
        """
        if output_dir is None:
            raise ValueError("output_dir 不能为空，必须传入三级目录路径")
        video_id = extract_video_id(video_url, "youtube")
        video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(video_path):
            return video_path
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        cookiefile = self._write_cookiefile()
        try:
            ydl_opts = {
                'format': 'bv[height<=1080][ext=mp4]+ba[ext=m4a]/bv[height<=1080]/b[height<=1080][ext=mp4]/b',
                'outtmpl': output_path,
                'noplaylist': True,
                'quiet': False,
                'merge_output_format': 'mp4',
                'extractor_args': {'youtube': {'player_client': ['ios', 'android']}},
            }
            if cookiefile:
                ydl_opts['cookiefile'] = cookiefile

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                video_path = os.path.join(output_dir, f"{video_id}.mp4")

            if not os.path.exists(video_path):
                raise FileNotFoundError(f"视频文件未找到: {video_path}")

            return video_path
        except Exception as e:
            error_msg = str(e)
            if "Sign in to confirm you're not a bot" in error_msg or "cookies" in error_msg.lower():
                logger.error(YOUTUBE_COOKIE_ERROR_MSG)
                raise ValueError(YOUTUBE_COOKIE_ERROR_MSG) from e
            raise
        finally:
            self._cleanup_cookiefile(cookiefile)