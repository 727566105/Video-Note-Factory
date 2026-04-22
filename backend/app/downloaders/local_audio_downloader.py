import os
from abc import ABC
from typing import Optional

from app.downloaders.base import Downloader
from app.enmus.note_enums import DownloadQuality
from app.models.notes_model import AudioDownloadResult


# 支持的音频扩展名
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus'}


class LocalAudioDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def download(
            self,
            video_url: str,
            output_dir: str = None,
            quality: DownloadQuality = "fast",
            need_video: Optional[bool] = False
    ) -> AudioDownloadResult:
        """
        处理本地音频文件，直接使用（跳过视频转音频步骤）
        """
        # 处理上传路径
        if video_url.startswith('/uploads'):
            project_root = os.getcwd()
            video_url = os.path.join(project_root, video_url.lstrip('/'))
            video_url = os.path.normpath(video_url)

        if not os.path.exists(video_url):
            raise FileNotFoundError(f"本地音频文件不存在: {video_url}")

        # 验证是音频文件
        _, ext = os.path.splitext(video_url)
        if ext.lower() not in AUDIO_EXTENSIONS:
            raise ValueError(f"不支持的音频格式: {ext}，支持格式: {', '.join(AUDIO_EXTENSIONS)}")

        file_name = os.path.basename(video_url)
        title, _ = os.path.splitext(file_name)

        return AudioDownloadResult(
            file_path=video_url,
            title=title,
            duration=0,
            cover_url='',  # 音频无封面
            platform="local_audio",
            video_id=title,
            raw_info={
                'path': video_url,
                'format': ext.lower().lstrip('.'),
            },
            video_path=None
        )
