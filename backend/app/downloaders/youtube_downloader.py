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
            except Exception:
                pass

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
            print('os.path.join(output_dir, f"{video_id}.{ext}")',os.path.join(output_dir, f"{video_id}.{ext}"))

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
                except Exception as e:
                    logger.warning(f"封面下载失败: {e}")

            return AudioDownloadResult(
                file_path=audio_path,
                title=title,
                duration=duration,
                cover_url=cover_url,
                platform="youtube",
                video_id=video_id,
                raw_info={'tags':info.get('tags'), 'uploader': info.get('uploader') or info.get('channel', '')},
                video_path=None,
                author_id=info.get("channel_id"),
                author_name=info.get("uploader") or info.get("channel") or None,
            )
        except Exception as e:
            error_msg = str(e)
            if "Sign in to confirm you're not a bot" in error_msg or "cookies" in error_msg.lower():
                logger.error(YOUTUBE_COOKIE_ERROR_MSG)
                raise Exception(YOUTUBE_COOKIE_ERROR_MSG) from e
            raise
        finally:
            self._cleanup_cookiefile(cookiefile)

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
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
            )
        except Exception as e:
            error_msg = str(e)
            if "Sign in to confirm you're not a bot" in error_msg or "cookies" in error_msg.lower():
                logger.error(YOUTUBE_COOKIE_ERROR_MSG)
                raise Exception(YOUTUBE_COOKIE_ERROR_MSG) from e
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
                raise Exception(YOUTUBE_COOKIE_ERROR_MSG) from e
            raise
        finally:
            self._cleanup_cookiefile(cookiefile)