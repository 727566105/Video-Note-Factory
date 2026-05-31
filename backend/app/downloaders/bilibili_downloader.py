import os
import re
import tempfile
import requests
from abc import ABC
from typing import Union, Optional

import yt_dlp
from yt_dlp.utils import DownloadError

from app.downloaders.base import Downloader, DownloadQuality, QUALITY_MAP
from app.models.audio_model import VideoInfoResult
from app.models.notes_model import AudioDownloadResult
from app.services.cookie_manager import CookieConfigManager
from app.utils.url_parser import extract_video_id
from app.utils.logger import get_logger

logger = get_logger(__name__)

# B站下载错误的友好提示
BILI_COOKIE_ERROR_MSG = "B站 Cookie 缺失或过期，请在设置中配置有效的 SESSDATA。获取方法：登录 bilibili.com → F12 → Application → Cookies → 复制 SESSDATA 值"

cfm = CookieConfigManager()


class BilibiliDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def _fetch_description(self, bvid: str) -> Optional[str]:
        """调用B站视频详情API获取描述"""
        try:
            url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
            headers = {
                "Referer": "https://www.bilibili.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            # 使用 Cookie 提高成功率
            cookie_str = cfm.get("bilibili")
            if cookie_str:
                headers["Cookie"] = cookie_str

            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == 0:
                    desc = data.get("data", {}).get("desc", "")
                    logger.info(f"获取B站视频描述成功: {bvid}, 长度: {len(desc)}")
                    return desc if desc else None
        except Exception as e:
            logger.warning(f"获取B站视频描述失败: {bvid}, {e}")
        return None

    def _extract_tags(self, info: dict) -> list[str]:
        """从 yt-dlp info 和 desc 中提取标签"""
        tags = []
        # yt-dlp 标准字段
        if info.get("tags"):
            tags.extend(info["tags"][:5])
        if info.get("categories"):
            tags.extend(info["categories"][:3])
        # 从 desc 中提取 #标签#
        desc = info.get("description", "")
        if desc:
            hash_tags = re.findall(r'#(\w+)#', desc)
            tags.extend(hash_tags[:3])
        return tags[:8]

    def _write_cookiefile(self) -> Optional[str]:
        """将 cookie 写入临时 Netscape 格式文件，返回文件路径"""
        cookie_str = cfm.get("bilibili")
        if not cookie_str:
            return None

        # 转换浏览器格式 cookie 为 Netscape 格式
        lines = ["# Netscape HTTP Cookie File\n"]
        for item in cookie_str.split(';'):
            item = item.strip()
            if '=' in item:
                name, value = item.split('=', 1)
                # Netscape 格式: domain flag path secure expiration name value
                lines.append(f".bilibili.com\tTRUE\t/\tTRUE\t0\t{name.strip()}\t{value.strip()}\n")

        # 写入临时文件
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

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        cookiefile = self._write_cookiefile()
        try:
            ydl_opts = {'noplaylist': True, 'quiet': True}
            if cookiefile:
                ydl_opts['cookiefile'] = cookiefile
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                video_id = info.get("id", "")
                title = info.get("title", "")
                duration = info.get("duration", 0) or 0
                cover_url = info.get("thumbnail")
                author_id = str(info.get("uploader_id", "")) or str(info.get("channel_id", ""))
                owner = info.get("owner", {})
                author_name = owner.get("name", "") if owner else info.get("uploader", "")
                description = self._fetch_description(video_id)
                return VideoInfoResult(
                    title=title, duration=duration, cover_url=cover_url,
                    platform="bilibili", video_id=video_id,
                    author_id=author_id or None, author_name=author_name or None,
                    description=description, raw_info=info,
                )
        finally:
            self._cleanup_cookiefile(cookiefile)

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
        }
        if cookiefile:
            ydl_opts['cookiefile'] = cookiefile

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info.get("id")
                title = info.get("title")
                duration = info.get("duration", 0)
                cover_url = info.get("thumbnail")
                audio_path = os.path.join(output_dir, f"{video_id}.mp3")

                # 获取B站视频描述
                description = self._fetch_description(video_id)

                # 下载封面到视频目录（使用统一下载工具）
                author_id = str(info.get("uploader_id", "")) or str(info.get("channel_id", ""))
                owner = info.get("owner", {})
                author_name = owner.get("name", "") if owner else info.get("uploader", "")
                if cover_url and output_dir:
                    try:
                        from app.utils.download_helper import DownloadHelper
                        temp_cover = DownloadHelper.download_file(
                            cover_url, output_dir, "_temp_cover.jpg",
                            referer="https://www.bilibili.com/", timeout=10
                        )
                        if temp_cover:
                            from app.utils.video_helper import save_cover_to_video_dir
                            cover_url = save_cover_to_video_dir(
                                temp_cover, output_dir, "bilibili", author_id, video_id
                            )
                            os.remove(temp_cover)
                    except Exception as e:
                        logger.warning(f"封面下载失败: {e}")

            return AudioDownloadResult(
                file_path=audio_path,
                title=title,
                duration=duration,
                cover_url=cover_url,
                platform="bilibili",
                video_id=video_id,
                raw_info=info,
                video_path=None,
                description=description,
                author_id=author_id,
                author_name=author_name or None,
                tags=self._extract_tags(info),
            )
        except DownloadError as e:
            error_msg = str(e)
            if "412" in error_msg or "Precondition Failed" in error_msg:
                raise ValueError(BILI_COOKIE_ERROR_MSG) from e
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
        os.makedirs(output_dir, exist_ok=True)
        logger.debug(f"下载视频: {video_url}")
        video_id=extract_video_id(video_url, "bilibili")
        video_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(video_path):
            return video_path

        output_path = os.path.join(output_dir, "%(id)s.%(ext)s")
        cookiefile = self._write_cookiefile()

        ydl_opts = {
            'format': 'bv[height<=1080][ext=mp4]+ba[ext=m4a]/bv[height<=1080]/bestvideo[height<=1080]+bestaudio/best',
            'outtmpl': output_path,
            'noplaylist': True,
            'quiet': False,
            'merge_output_format': 'mp4',
        }
        if cookiefile:
            ydl_opts['cookiefile'] = cookiefile

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
        finally:
            self._cleanup_cookiefile(cookiefile)

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