import os
from abc import ABC
from typing import Union, Optional

import yt_dlp
from yt_dlp.utils import DownloadError

from app.downloaders.base import Downloader, DownloadQuality, QUALITY_MAP
from app.models.notes_model import AudioDownloadResult
from app.services.cookie_manager import CookieConfigManager
from app.utils.path_helper import get_data_dir
from app.utils.url_parser import extract_video_id
from app.utils.logger import get_logger

logger = get_logger(__name__)

# B站下载错误的友好提示
BILI_COOKIE_ERROR_MSG = "B站 Cookie 缺失或过期，请在设置中配置有效的 SESSDATA。获取方法：登录 bilibili.com → F12 → Application → Cookies → 复制 SESSDATA 值"

cfm = CookieConfigManager()


class BilibiliDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def _get_headers(self) -> dict:
        """获取请求头，包含 cookie"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com/',
        }
        cookie = cfm.get("bilibili")
        if cookie:
            headers['Cookie'] = cookie
        return headers

    def download(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
        quality: DownloadQuality = "fast",
        need_video:Optional[bool]=False
    ) -> AudioDownloadResult:
        if output_dir is None:
            output_dir = get_data_dir()
        if not output_dir:
            output_dir=self.cache_data
        os.makedirs(output_dir, exist_ok=True)

        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'outtmpl': output_path,
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '64',
                }
            ],
            'noplaylist': True,
            'quiet': False,
            'http_headers': self._get_headers(),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                title = info.get("title")
                duration = info.get("duration", 0)
                cover_url = info.get("thumbnail")
                audio_path = os.path.join(output_dir, f"{video_id}.mp3")

            return AudioDownloadResult(
                file_path=audio_path,
                title=title,
                duration=duration,
                cover_url=cover_url,
                platform="bilibili",
                video_id=video_id,
                raw_info=info,
                video_path=None  # ❗音频下载不包含视频路径
            )
        except DownloadError as e:
            error_msg = str(e)
            if "412" in error_msg or "Precondition Failed" in error_msg:
                raise ValueError(BILI_COOKIE_ERROR_MSG) from e
            raise

    def download_video(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
    ) -> str:
        """
        下载视频，返回视频文件路径
        """

        if output_dir is None:
            output_dir = get_data_dir()
        os.makedirs(output_dir, exist_ok=True)
        logger.debug(f"下载视频: {video_url}")
        video_id=extract_video_id(video_url, "bilibili")
        video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(video_path):
            return video_path

        # 检查是否已经存在


        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

        ydl_opts = {
            'format': 'bv*[ext=mp4]/bestvideo+bestaudio/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'merge_output_format': 'mp4',
            'http_headers': self._get_headers(),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                video_path = os.path.join(output_dir, f"{video_id}.mp4")
        except DownloadError as e:
            error_msg = str(e)
            if "412" in error_msg or "Precondition Failed" in error_msg:
                raise ValueError(BILI_COOKIE_ERROR_MSG) from e
            raise

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件未找到: {video_path}")

        return video_path

    def delete_video(self, video_path: str) -> str:
        """
        删除视频文件
        """
        if os.path.exists(video_path):
            os.remove(video_path)
            return f"视频文件已删除: {video_path}"
        else:
            return f"视频文件未找到: {video_path}"