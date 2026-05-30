import os
import re
import subprocess
import requests as http_requests
from abc import ABC
from typing import Union, Optional

import yt_dlp

from app.downloaders.base import Downloader, DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CCTVDownloader(Downloader, ABC):
    """
    CCTV（央视网）视频下载器

    支持URL格式：
    - https://tv.cctv.com/{YYYY}/{MM}/{DD}/VID{random}.shtml
    - https://v.cctv.com/{path}.html

    混合方案：API优先获取高清画质，失败时自动切换yt-dlp备用
    """

    CCTV_API = "http://vdn.apps.cntv.cn/api/getHttpVideoInfo.do"
    GUID_PATTERN = r'var\s+guid\s*=\s*"([a-f0-9]{32})"'
    VIDEO_CENTER_ID_PATTERN = r'videoCenterId\s*[=:]\s*"([a-f0-9]{32})"'

    ERROR_MESSAGES = {
        "guid_not_found": "无法从页面解析视频ID，请检查链接是否正确",
        "api_failed": "央视视频信息获取失败，可能受地区限制",
        "stream_unavailable": "视频流不可用，请稍后重试",
    }

    def __init__(self):
        super().__init__()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://tv.cctv.com/",
            "Accept": "*/*",
        }

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """获取视频元数据（优先API，备用yt-dlp）"""
        guid = self._extract_guid_from_page(video_url)

        if guid:
            try:
                return self._get_info_from_api(guid, video_url)
            except Exception as e:
                logger.warning(f"API获取失败，切换yt-dlp: {e}")

        # 备用：使用yt-dlp
        return self._get_info_from_ytdlp(video_url)

    def download(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
        quality: DownloadQuality = "fast",
        need_video: Optional[bool] = False
    ) -> AudioDownloadResult:
        """下载音频/视频"""
        if output_dir is None:
            raise ValueError("output_dir 不能为空，必须传入三级目录路径")
        os.makedirs(output_dir, exist_ok=True)

        guid = self._extract_guid_from_page(video_url)
        video_id = guid or self._extract_video_id_from_url(video_url)

        # 尝试API方式获取高清流
        if guid:
            try:
                api_data = self._fetch_video_info_api(guid)
                stream_url = self._get_best_stream_url(api_data)

                # 下载视频
                mp4_path = os.path.join(output_dir, f"{video_id}.mp4")
                self._download_hls_stream(stream_url, mp4_path)

                # 提取音频
                mp3_path = os.path.join(output_dir, f"{video_id}.mp3")
                self._extract_audio_from_mp4(mp4_path, mp3_path)

                # 获取封面
                cover_url = self._download_cover(api_data, output_dir, video_id)

                return AudioDownloadResult(
                    file_path=mp3_path,
                    title=api_data.get("title", ""),
                    duration=float(api_data.get("video", {}).get("totalLength", 0)),
                    cover_url=cover_url,
                    platform="cctv",
                    video_id=video_id,
                    raw_info=api_data,
                    video_path=mp4_path if need_video else None,
                    author_id="cctv",
                    author_name="央视网",
                )
            except Exception as e:
                logger.warning(f"API下载失败，切换yt-dlp: {e}")

        # 备用：使用yt-dlp
        return self._download_with_ytdlp(video_url, output_dir, need_video)

    def download_video(
        self,
        video_url: str,
        output_dir: Union[str, None] = None,
    ) -> str:
        """下载视频文件"""
        if output_dir is None:
            raise ValueError("output_dir 不能为空")

        guid = self._extract_guid_from_page(video_url)
        video_id = guid or self._extract_video_id_from_url(video_url)
        video_path = os.path.join(output_dir, f"{video_id}.mp4")

        if os.path.exists(video_path):
            return video_path

        os.makedirs(output_dir, exist_ok=True)

        # 尝试API方式
        if guid:
            try:
                api_data = self._fetch_video_info_api(guid)
                stream_url = self._get_best_stream_url(api_data)
                self._download_hls_stream(stream_url, video_path)
                return video_path
            except Exception as e:
                logger.warning(f"API下载视频失败，切换yt-dlp: {e}")

        # 备用：yt-dlp
        ydl_opts = {
            'format': 'best[ext=mp4]/best',
            'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
            'noplaylist': True,
            'quiet': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get("id")
            ext = info.get("ext", "mp4")
            video_path = os.path.join(output_dir, f"{video_id}.{ext}")

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"视频文件未找到: {video_path}")

        return video_path

    # ==================== 辅助方法 ====================

    def _extract_guid_from_page(self, url: str) -> str:
        """从CCTV页面HTML中提取32位GUID"""
        try:
            resp = http_requests.get(url, headers=self.headers, timeout=15)
            resp.raise_for_status()

            # 主要模式
            match = re.search(self.GUID_PATTERN, resp.text)
            if match:
                guid = match.group(1)
                logger.info(f"成功提取GUID: {guid}")
                return guid

            # 备用模式
            match = re.search(self.VIDEO_CENTER_ID_PATTERN, resp.text)
            if match:
                return match.group(1)

            logger.error(f"无法从页面提取GUID: {url}")
            return ""

        except http_requests.RequestException as e:
            logger.error(f"获取CCTV页面失败: {e}")
            return ""

    def _extract_video_id_from_url(self, url: str) -> str:
        """从URL中提取视频ID（VID部分）"""
        match = re.search(r"VID([A-Za-z0-9]+)", url)
        if match:
            return f"VID{match.group(1)}"
        # 兜底：取URL最后一部分
        parts = url.rstrip("/").split("/")
        return parts[-1].replace(".shtml", "").replace(".html", "")

    def _fetch_video_info_api(self, guid: str) -> dict:
        """调用CCTV VDN API获取视频信息"""
        api_url = f"{self.CCTV_API}?pid={guid}&url=&idl=32&idlr=32&modifyed=false"
        resp = http_requests.get(api_url, headers=self.headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if not data or "hls_url" not in data:
            raise ValueError(self.ERROR_MESSAGES["stream_unavailable"])

        return data

    def _get_best_stream_url(self, api_data: dict) -> str:
        """从API数据中选择最高画质流"""
        hls_url = api_data.get("hls_url", "")

        if not hls_url:
            raise ValueError(self.ERROR_MESSAGES["stream_unavailable"])

        # 去除码率限制获取更高画质
        hls_url = re.sub(r'maxbr=\d+&?', '', hls_url)
        hls_url = hls_url.rstrip('&')

        # 替换为高清CDN（可选优化）
        # hls_url = hls_url.replace('/asp/hls/', '/asp/h5e/hls/')

        logger.info(f"选择视频流URL: {hls_url}")
        return hls_url

    def _download_hls_stream(self, m3u8_url: str, output_path: str) -> str:
        """使用ffmpeg下载HLS流"""
        try:
            cmd = [
                "ffmpeg",
                "-i", m3u8_url,
                "-c", "copy",
                "-y",
                output_path
            ]

            subprocess.run(
                cmd,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=300
            )

            logger.info(f"HLS流下载完成: {output_path}")
            return output_path

        except subprocess.TimeoutExpired:
            raise ValueError("视频下载超时（可能文件过大）")
        except subprocess.CalledProcessError as e:
            raise ValueError(f"ffmpeg下载失败: {e}")

    def _extract_audio_from_mp4(self, mp4_path: str, mp3_path: str) -> str:
        """使用ffmpeg从MP4提取MP3音频"""
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-i", mp4_path,
                "-vn",
                "-acodec", "libmp3lame",
                "-q:a", "2",
                mp3_path
            ]

            subprocess.run(
                cmd,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=60
            )

            logger.info(f"音频提取完成: {mp3_path}")
            return mp3_path

        except subprocess.CalledProcessError as e:
            raise ValueError(f"音频提取失败: {e}")

    def _download_cover(self, api_data: dict, output_dir: str, video_id: str) -> Optional[str]:
        """下载封面图"""
        cover_url = api_data.get("cover_url") or api_data.get("f_cover") or api_data.get("image")
        if not cover_url:
            return None

        try:
            from app.utils.download_helper import DownloadHelper
            cover_path = DownloadHelper.download_file(
                cover_url, output_dir, "cover.jpg",
                referer="https://www.cctv.com/", timeout=10
            )
            if cover_path:
                return f"/api/video_cover/cctv/cctv/{video_id}"
        except Exception as e:
            logger.warning(f"封面下载失败: {e}")

        return cover_url

    def _get_info_from_api(self, guid: str, video_url: str) -> VideoInfoResult:
        """通过API获取视频信息"""
        api_data = self._fetch_video_info_api(guid)

        return VideoInfoResult(
            title=api_data.get("title", ""),
            duration=float(api_data.get("video", {}).get("totalLength", 0)),
            cover_url=api_data.get("cover_url") or api_data.get("f_cover"),
            platform="cctv",
            video_id=guid,
            author_id="cctv",
            author_name="央视网",
            description=None,
            raw_info=api_data,
        )

    def _get_info_from_ytdlp(self, video_url: str) -> VideoInfoResult:
        """使用yt-dlp获取视频信息"""
        ydl_opts = {
            'quiet': True,
            'noplaylist': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

        return VideoInfoResult(
            title=info.get("title", ""),
            duration=info.get("duration", 0) or 0,
            cover_url=info.get("thumbnail"),
            platform="cctv",
            video_id=info.get("id", ""),
            author_id="cctv",
            author_name="央视网",
            description=info.get("description"),
            raw_info=info,
        )

    def _download_with_ytdlp(self, url: str, output_dir: str, need_video: bool) -> AudioDownloadResult:
        """使用yt-dlp下载"""
        ydl_opts = {
            'format': 'bestaudio/best' if not need_video else 'best[ext=mp4]/best',
            'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
            'noplaylist': True,
            'quiet': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id")
            ext = info.get("ext", "mp4")

            audio_path = os.path.join(output_dir, f"{video_id}.mp3")
            downloaded_path = os.path.join(output_dir, f"{video_id}.{ext}")

            # 如果下载的不是mp3，转换为mp3
            if ext != "mp3" and os.path.exists(downloaded_path):
                self._extract_audio_from_mp4(downloaded_path, audio_path)

            return AudioDownloadResult(
                file_path=audio_path,
                title=info.get("title", ""),
                duration=info.get("duration", 0),
                cover_url=info.get("thumbnail"),
                platform="cctv",
                video_id=video_id,
                raw_info=info,
                video_path=downloaded_path if need_video else None,
                author_id="cctv",
                author_name="央视网",
            )