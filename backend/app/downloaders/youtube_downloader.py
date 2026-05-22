import os
import requests as http_requests
from abc import ABC
from typing import Union, Optional

import yt_dlp

from app.downloaders.base import Downloader, DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult
from app.utils.url_parser import extract_video_id
from app.utils.logger import get_logger

logger = get_logger(__name__)


class YoutubeDownloader(Downloader, ABC):
    def __init__(self):

        super().__init__()

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

        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get("id")
            title = info.get("title")
            duration = info.get("duration", 0)
            cover_url = info.get("thumbnail")
            ext = info.get("ext", "m4a")  # 兜底用 m4a
            audio_path = os.path.join(output_dir, f"{video_id}.{ext}")
        print('os.path.join(output_dir, f"{video_id}.{ext}")',os.path.join(output_dir, f"{video_id}.{ext}"))

        # 下载封面到视频目录
        author_id = info.get("channel_id") or ""
        if cover_url and output_dir:
            try:
                resp = http_requests.get(
                    cover_url,
                    headers={"Referer": "https://www.youtube.com/"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    temp_cover = os.path.join(output_dir, "_temp_cover.jpg")
                    with open(temp_cover, "wb") as f:
                        f.write(resp.content)
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
            video_path=None,  # ❗音频下载不包含视频路径
            author_id=info.get("channel_id"),
        )

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        ydl_opts = {
            'quiet': True,
            'noplaylist': True,
        }
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

        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'merge_output_format': 'mp4',  # 确保合并成 mp4
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get("id")
            video_path = os.path.join(output_dir, f"{video_id}.mp4")

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件未找到: {video_path}")

        return video_path
