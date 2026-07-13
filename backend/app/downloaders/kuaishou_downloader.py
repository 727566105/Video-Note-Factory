import os
import subprocess
import logging
from abc import ABC
from typing import Union, Optional

import requests

from app.downloaders.base import Downloader
from app.downloaders.kuaishou_helper.kuaishou import KuaiShou
from app.enmus.note_enums import DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult

logger = logging.getLogger(__name__)


class KuaiShouDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        ks = KuaiShou()
        video_raw_info = ks.run(video_url)
        vision_detail = video_raw_info.get('visionVideoDetail') or {}
        photo_info = vision_detail.get('photo') or {}
        author_info = vision_detail.get('author') or {}

        ks_author = author_info.get('name', '') or photo_info.get('userName', '')
        ks_author_id = str(author_info.get('id', ''))

        # 检测内容类型：快手 atlas=图集，其他=视频
        photo_type = photo_info.get('photoType', '')
        content_type = "article" if photo_type == "atlas" else "video"

        return VideoInfoResult(
            title=(photo_info.get('caption') or '').strip().replace('\n', '').replace(' ', '_')[:50],
            duration=photo_info.get('duration', 0) or 0,
            cover_url=photo_info.get('coverUrl'),
            platform="kuaishou",
            video_id=photo_info.get('id', ''),
            author_id=ks_author_id,
            author_name=ks_author,
            description=photo_info.get('caption', ''),
            content_type=content_type,
            raw_info={
                'tags': ','.join(tag['name'] for tag in video_raw_info.get('tags', []) if tag.get('name')),
                'owner': {'name': ks_author},
            },
        )

    def download(
            self,
            video_url: str,
            output_dir: Union[str, None] = None,
            quality: str = "fast",
            need_video: Optional[bool] = False
    ) -> AudioDownloadResult:
        if output_dir is None:
            raise ValueError("output_dir 不能为空，必须传入三级目录路径")
        os.makedirs(output_dir, exist_ok=True)

        ks = KuaiShou()
        video_raw_info = ks.run(video_url)
        if not video_raw_info:
            raise ValueError("快手视频信息获取失败，请检查链接是否有效或 cookie 是否过期")
        vision_detail = video_raw_info.get('visionVideoDetail') or {}
        photo_info = vision_detail.get('photo') or {}
        video_id = photo_info.get('id', '')
        raw_caption = (photo_info.get('caption') or '').strip().replace('\n', '').replace(' ', '_')
        title = raw_caption[:50] if raw_caption else video_id
        mp4_path = os.path.join(output_dir, f"{video_id}.mp4")
        mp3_path = os.path.join(output_dir, f"{video_id}.mp3")
        ks_author = (vision_detail.get('author') or {}).get('name', '') or photo_info.get('userName', '')
        ks_author_id = str((vision_detail.get('author') or {}).get('id', ''))
        ks_tags = [tag['name'] for tag in video_raw_info.get('tags', []) if tag.get('name')]
        ks_description = photo_info.get('caption', '')

        # 下载封面到视频目录（使用统一下载工具）
        cover_url = photo_info.get('coverUrl', '')
        if cover_url and output_dir:
            try:
                from app.utils.download_helper import DownloadHelper
                temp_cover = DownloadHelper.download_file(
                    cover_url, output_dir, "_temp_cover.jpg",
                    referer="https://www.kuaishou.com/", timeout=10
                )
                if temp_cover:
                    from app.utils.video_helper import save_cover_to_video_dir
                    cover_url = save_cover_to_video_dir(
                        temp_cover, output_dir, "kuaishou", ks_author_id, video_id
                    )
                    os.remove(temp_cover)
                else:
                    # 下载失败：不保留远程 URL（CDN 签名 URL 会过期导致永久丢封面）
                    logger.warning(f"快手封面下载失败，丢弃远程 URL: {cover_url[:80]}")
                    cover_url = None
            except Exception as e:
                logger.warning(f"快手封面下载异常: {e}")
                cover_url = None

        # 图集分支：photoType == "atlas" 时走图文流程
        photo_type = photo_info.get('photoType', '')
        if photo_type == "atlas":
            return self._download_atlas_note(
                photo_info, output_dir, video_id, title, cover_url,
                ks_author_id, ks_author, ks_tags, ks_description
            )

        if os.path.exists(mp3_path):
            logger.info(f"[已存在] 跳过下载: {mp3_path}")
            return AudioDownloadResult(
                file_path=mp3_path,
                title=title,
                duration=photo_info.get('duration', 0) or 0,
                cover_url=cover_url,
                platform="kuaishou",
                video_id=video_id,
                description=ks_description,
                content_type="video",
                tags=ks_tags,
                raw_info={
                    'tags': ','.join(ks_tags),
                    'owner': {'name': ks_author},
                    'uploader': ks_author,
                },
                video_path=mp4_path,
                author_id=ks_author_id,
                author_name=ks_author or None,
            )

        # 下载 mp4 视频
        photo_url = photo_info.get('photoUrl', '')
        if not photo_url:
            raise ValueError("无法获取快手视频下载链接")

        from app.utils.download_helper import DownloadHelper
        _safe, _err = DownloadHelper.is_safe_url(photo_url)
        if not _safe:
            raise ValueError("视频 URL 不安全或无效")

        resp = requests.get(photo_url, stream=True, timeout=30)
        if resp.status_code == 200:
            with open(mp4_path, "wb") as f:
                for chunk in resp.iter_content(1024 * 1024):
                    f.write(chunk)
        else:
            raise ValueError(f"视频下载失败: 状态码 {resp.status_code}")

        # 使用 ffmpeg 转换为 mp3
        try:
            subprocess.run([
                "ffmpeg", "-y", "-i", mp4_path, "-vn", "-acodec", "libmp3lame", mp3_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            raise ValueError("ffmpeg 转换 MP3 失败")

        return AudioDownloadResult(
            file_path=mp3_path,
            title=title,
            duration=photo_info.get('duration', 0) or 0,
            cover_url=cover_url,
            platform="kuaishou",
            video_id=video_id,
            description=ks_description,
            content_type="video",
            tags=ks_tags,
            raw_info={
                'tags': ','.join(ks_tags),
                'owner': {'name': ks_author},
                'uploader': ks_author,
            },
            video_path=mp4_path,
            author_id=ks_author_id,
            author_name=ks_author or None,
        )

    def _download_atlas_note(self, photo_info, output_dir, video_id, title, cover_url,
                              author_id, author_name, tags, description) -> AudioDownloadResult:
        """下载快手图集（atlas 类型）：提取图片并下载"""
        from app.utils.download_helper import DownloadHelper

        # 快手图集图片 URL 从 manifest 或 atlas 字段提取
        img_urls = []
        manifest = photo_info.get('manifest') or {}
        adaptation_set = manifest.get('adaptationSet') or []
        for adp in adaptation_set:
            for rep in (adp.get('representation') or []):
                url = rep.get('url')
                if url and url.startswith('http'):
                    img_urls.append(url)

        # 如果 manifest 没有，尝试从 ext_params/atlas 提取
        if not img_urls:
            ext_params = photo_info.get('ext_params') or {}
            atlas = ext_params.get('atlas') or {}
            for item in (atlas.get('items') or []):
                url = item.get('url') or item.get('imgUrl')
                if url and url.startswith('http'):
                    img_urls.append(url)

        if not img_urls:
            logger.warning(f"快手图集 {video_id} 未提取到图片 URL，尝试用 coverUrl 兜底")

        # 下载图片
        downloaded_paths = []
        for i, img_url in enumerate(img_urls):
            img_path = DownloadHelper.download_file(
                img_url, output_dir, f"image_{i+1}.jpg",
                referer="https://www.kuaishou.com/", timeout=15
            )
            if img_path:
                downloaded_paths.append(img_path)

        # 如果有下载的图片但没有封面，用第一张做封面
        if not cover_url and downloaded_paths:
            from app.utils.video_helper import save_cover_to_video_dir
            try:
                cover_url = save_cover_to_video_dir(
                    downloaded_paths[0], output_dir, "kuaishou", author_id, video_id
                )
            except Exception as e:
                logger.warning(f"快手图集封面保存失败: {e}")
                cover_url = None

        return AudioDownloadResult(
            file_path=None,
            title=title,
            duration=0,
            cover_url=cover_url,
            platform="kuaishou",
            video_id=video_id,
            description=description,
            content_type="article",
            images=downloaded_paths,
            tags=tags,
            raw_info={
                'tags': ','.join(tags),
                'owner': {'name': author_name},
                'photoType': 'atlas',
            },
            author_id=author_id,
            author_name=author_name or None,
        )

    def download_video(
            self,
            video_url: str,
            output_dir: Union[str, None] = None,
    ) -> str:
        result = self.download(video_url, output_dir)
        return result.video_path if result else None


if __name__ == '__main__':
    ks = KuaiShouDownloader()
    ks.download('https://v.kuaishou.com/2vBqX74 王宝强携手刘昊然、岳云鹏上演精彩名场面 全程高能 看一遍笑一遍 "唐探1900 "快成长计划 ...更多')