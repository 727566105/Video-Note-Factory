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
            except Exception as e:
                logger.warning(f"清理临时 cookie 文件失败: {e}")

    def _extract_metadata(self, info: dict) -> dict:
        """从 yt-dlp info 提取公共字段"""
        author_id = str(info.get("uploader_id", "")) or str(info.get("channel_id", ""))
        owner = info.get("owner", {})
        author_name = owner.get("name", "") if owner else info.get("uploader", "")
        return {
            "video_id": info.get("id", ""),
            "title": info.get("title", ""),
            "duration": info.get("duration", 0) or 0,
            "cover_url": info.get("thumbnail"),
            "author_id": author_id or None,
            "author_name": author_name or None,
        }

    def _is_article_url(self, video_url: str) -> bool:
        """检测是否为B站专栏链接（cv 链接）"""
        return bool(re.search(r'(read\.bilibili\.com|/read/cv|/read/)', video_url))

    def _extract_cv_id(self, video_url: str) -> str:
        """从专栏链接提取 cv_id"""
        match = re.search(r'cv(\d+)', video_url)
        if match:
            return match.group(1)
        # read.bilibili.com/plain/?id=xxx 格式
        match = re.search(r'[?&]id=(\d+)', video_url)
        if match:
            return match.group(1)
        return ""

    def _fetch_article_content(self, cv_id: str) -> dict:
        """通过B站专栏 API 获取专栏内容和图片"""
        api_url = f"https://api.bilibili.com/x/article/viewinfo?aid={cv_id}"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(api_url, headers=headers, timeout=15)
        if resp.status_code != 200:
            raise ValueError(f"B站专栏 API 请求失败: {resp.status_code}")
        data = resp.json()
        if data.get("code") != 0:
            raise ValueError(f"B站专栏 API 返回错误: {data.get('message', 'unknown')}")
        return data.get("data", {})

    def _get_article_info(self, video_url: str) -> VideoInfoResult:
        """获取B站专栏元数据"""
        cv_id = self._extract_cv_id(video_url)
        if not cv_id:
            raise ValueError("无法从链接提取B站专栏 ID")
        article = self._fetch_article_content(cv_id)
        # 从 HTML 正文中提取图片 URL
        content = article.get("content", "")
        img_urls = re.findall(r'src="(https?://[^"]*\.(?:jpg|png|webp|gif))"', content)
        # 标题兜底：专栏无标题时用 cv_id（避免目录名为空）
        title = article.get("title", "") or f"cv{cv_id}"
        return VideoInfoResult(
            title=title,
            duration=0,
            cover_url=img_urls[0] if img_urls else None,
            platform="bilibili",
            video_id=f"cv{cv_id}",
            author_id=str(article.get("mid", "")),
            author_name=article.get("author", {}).get("name", ""),
            description=article.get("summary", "") or re.sub(r'<[^>]+>', '', content)[:500],
            content_type="article",
            # raw_info['images'] 这里是远程 URL（get_info 不下载）；
            # download 路径里是本地路径。上游 note.py 同时兼容两种类型。
            raw_info={"images": img_urls, "cv_id": cv_id},
        )

    def _download_article_note(self, video_url: str, output_dir: str) -> AudioDownloadResult:
        """下载B站专栏图文（图片 + 正文）"""
        cv_id = self._extract_cv_id(video_url)
        if not cv_id:
            raise ValueError("无法从链接提取B站专栏 ID")
        article = self._fetch_article_content(cv_id)
        content = article.get("content", "")
        title = article.get("title", f"cv{cv_id}")

        # 提取图片 URL 并下载
        img_urls = re.findall(r'src="(https?://[^"]*\.(?:jpg|png|webp|gif))"', content)
        downloaded_paths = []
        from app.utils.download_helper import DownloadHelper
        for i, img_url in enumerate(img_urls):
            img_path = DownloadHelper.download_file(
                img_url, output_dir, f"image_{i+1}.jpg",
                referer="https://www.bilibili.com/", timeout=15
            )
            if img_path:
                downloaded_paths.append(img_path)

        # 封面用第一张图
        cover_url = None
        if downloaded_paths:
            from app.utils.video_helper import save_cover_to_video_dir
            try:
                cover_url = save_cover_to_video_dir(
                    downloaded_paths[0], output_dir, "bilibili",
                    str(article.get("mid", "bilibili")), f"cv{cv_id}"
                )
            except Exception as e:
                logger.warning(f"B站专栏封面保存失败: {e}")
                cover_url = None

        # 纯文本描述（去掉 HTML 标签）
        import html as html_module
        clean_text = re.sub(r'<[^>]+>', '', content)
        clean_text = html_module.unescape(clean_text).strip()

        return AudioDownloadResult(
            file_path=None,
            title=title,
            duration=0,
            cover_url=cover_url,
            platform="bilibili",
            video_id=f"cv{cv_id}",
            description=article.get("summary", "") or clean_text[:500],
            content_type="article",
            images=downloaded_paths,
            raw_info={"cv_id": cv_id, "images": downloaded_paths},
            author_id=str(article.get("mid", "")),
            author_name=article.get("author", {}).get("name", ""),
            tags=[],
        )

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        # 专栏链接走图文分支
        if self._is_article_url(video_url):
            return self._get_article_info(video_url)
        cookiefile = self._write_cookiefile()
        try:
            ydl_opts = {'noplaylist': True, 'quiet': True}
            if cookiefile:
                ydl_opts['cookiefile'] = cookiefile
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                meta = self._extract_metadata(info)
                description = self._fetch_description(meta["video_id"])
                return VideoInfoResult(
                    title=meta["title"], duration=meta["duration"], cover_url=meta["cover_url"],
                    platform="bilibili", video_id=meta["video_id"],
                    author_id=meta["author_id"], author_name=meta["author_name"],
                    description=description, raw_info=info,
                    content_type="video",
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

        # 专栏链接走图文分支
        if self._is_article_url(video_url):
            return self._download_article_note(video_url, output_dir)

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
                meta = self._extract_metadata(info)
                audio_path = os.path.join(output_dir, f"{meta['video_id']}.mp3")

                # 获取B站视频描述
                description = self._fetch_description(meta["video_id"])

                # 下载封面到视频目录（使用统一下载工具）
                cover_url = meta["cover_url"]
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
                                temp_cover, output_dir, "bilibili", meta["author_id"], meta["video_id"]
                            )
                            os.remove(temp_cover)
                        else:
                            # 下载失败：不保留远程 URL（CDN URL 可能失效）
                            logger.warning(f"B站封面下载失败，丢弃远程 URL: {cover_url[:80]}")
                            cover_url = None
                    except Exception as e:
                        logger.warning(f"B站封面下载异常: {e}")
                        cover_url = None

            return AudioDownloadResult(
                file_path=audio_path,
                title=meta["title"],
                duration=meta["duration"],
                cover_url=cover_url,
                platform="bilibili",
                video_id=meta["video_id"],
                raw_info=info,
                video_path=None,
                description=description,
                content_type="video",
                author_id=meta["author_id"],
                author_name=meta["author_name"],
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