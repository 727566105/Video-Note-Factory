import os
import subprocess
import logging
from abc import ABC
from typing import Optional

from app.downloaders.base import Downloader
from app.enmus.note_enums import DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult

logger = logging.getLogger(__name__)

from app.utils.video_helper import save_cover_to_static
from app.utils.upload_path import resolve_uploaded_file_path


class LocalDownloader(Downloader, ABC):
    def __init__(self):

        super().__init__()


    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        # 处理本地文件路径，仅允许上传目录内文件
        file_path = str(resolve_uploaded_file_path(video_url))

        file_name = os.path.basename(file_path)
        title, _ = os.path.splitext(file_name)

        # 使用 ffmpeg 获取视频时长
        duration = 0
        try:
            result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', file_path
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            duration = float(result.stdout.decode().strip() or 0)
        except (subprocess.CalledProcessError, ValueError):
            duration = 0

        return VideoInfoResult(
            title=title,
            duration=duration,
            cover_url=None,  # 本地文件暂无封面 URL
            platform="local",
            video_id=title,
            author_id=None,
            author_name=None,
            description=None,
            raw_info={'path': file_path},
        )

    def extract_cover(self, input_path: str, output_dir: Optional[str] = None) -> str:
        """
        从本地视频文件中提取一张封面图（默认取第一帧）
        :param input_path: 输入视频路径
        :param output_dir: 输出目录，默认和视频同目录
        :return: 提取出的封面图片路径
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"输入文件不存在: {input_path}")

        if output_dir is None:
            output_dir = os.path.dirname(input_path)

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(output_dir, f"{base_name}_cover.jpg")

        try:
            command = [
                'ffmpeg',
                '-i', input_path,
                '-ss', '00:00:01',  # 跳到视频第1秒，防止黑屏
                '-vframes', '1',  # 只截取一帧
                '-q:v', '2',  # 输出质量高一点（qscale，2是很高）
                '-y',  # 覆盖
                output_path
            ]
            subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            if not os.path.exists(output_path):
                raise ValueError(f"封面图片生成失败: {output_path}")

            return output_path
        except subprocess.CalledProcessError as e:
            raise ValueError(f"提取封面失败: {output_path}") from e

    def convert_to_mp3(self,input_path: str, output_path: str = None) -> str:
        """
        将本地视频文件转为 MP3 音频文件
        :param input_path: 输入文件路径（如 .mp4）
        :param output_path: 输出文件路径（可选，默认同目录同名 .mp3）
        :return: 生成的 mp3 文件路径
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"输入文件不存在: {input_path}")

        if output_path is None:
            base, _ = os.path.splitext(input_path)
            output_path = base + ".mp3"
        try:
        # 调用 ffmpeg 转换
            command = [
                'ffmpeg',
                '-i', input_path,
                '-vn',  # 不要视频流
                '-acodec', 'libmp3lame',  # 使用mp3编码
                '-y',  # 覆盖输出文件
                output_path
            ]

            subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            if not os.path.exists(output_path):
                raise ValueError(f"mp3 文件生成失败: {output_path}")

            return output_path
        except subprocess.CalledProcessError as e:
            raise ValueError(f"mp3 文件生成失败: {output_path}") from e
    def download_video(self, video_url: str, output_dir: str = None) -> str:
        """
        处理本地文件路径，返回视频文件路径
        """
        return str(resolve_uploaded_file_path(video_url))
    def download(
            self,
            video_url: str,
            output_dir: str = None,
            quality: DownloadQuality = "fast",
            need_video: Optional[bool] = False,
            author_id: Optional[str] = None,
            author_name: Optional[str] = None,
    ) -> AudioDownloadResult:
        """
        处理本地文件路径，返回音频元信息
        """
        video_url = str(resolve_uploaded_file_path(video_url))

        file_name = os.path.basename(video_url)
        title, _ = os.path.splitext(file_name)
        logger.info(f"本地文件下载: {file_name}")
        file_path=self.convert_to_mp3(video_url)

        # 封面提取失败时降级为 None，不中断整个下载
        cover_url = None
        try:
            cover_path = self.extract_cover(video_url)
            if cover_path and output_dir:
                from app.utils.video_helper import save_cover_to_video_dir
                cover_url = save_cover_to_video_dir(
                    cover_path, output_dir, "local", author_id or "local", title
                )
                os.remove(cover_path)
        except Exception as e:
            logger.warning(f"本地视频封面提取失败（降级为无封面）: {e}")
            cover_url = None

        # 读取视频时长
        duration = 0
        try:
            result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', video_url
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            duration = float(result.stdout.decode().strip() or 0)
        except (subprocess.CalledProcessError, ValueError):
            duration = 0

        return AudioDownloadResult(
            file_path=file_path,
            title=title,
            duration=duration,
            cover_url=cover_url,  # 暂无封面
            platform="local",
            video_id=title,
            raw_info={
                'path':  file_path
            },
            video_path=None,
            author_id=author_id,
            author_name=author_name,
        )
