import os
import subprocess
from abc import ABC
from typing import Union, Optional

import requests

from app.downloaders.base import Downloader
from app.downloaders.kuaishou_helper.kuaishou import KuaiShou
from app.enmus.note_enums import DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult


class KuaiShouDownloader(Downloader, ABC):
    def __init__(self):
        super().__init__()

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        ks = KuaiShou()
        video_raw_info = ks.run(video_url)
        photo_info = video_raw_info['visionVideoDetail']['photo']
        author_info = video_raw_info.get('visionVideoDetail', {}).get('author', {})

        ks_author = author_info.get('name', '') or photo_info.get('userName', '')
        ks_author_id = str(author_info.get('id', ''))

        return VideoInfoResult(
            title=photo_info.get('caption', '').strip().replace('\n', '').replace(' ', '_')[:50],
            duration=photo_info.get('duration', 0) or 0,
            cover_url=photo_info.get('coverUrl'),
            platform="kuaishou",
            video_id=photo_info.get('id', ''),
            author_id=ks_author_id,
            author_name=ks_author,
            description=photo_info.get('caption', ''),
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
        print(video_raw_info)
        photo_info = video_raw_info['visionVideoDetail']['photo']
        video_id = photo_info['id']
        title = photo_info['caption'].strip().replace('\n', '').replace(' ', '_')[:50]
        mp4_path = os.path.join(output_dir, f"{video_id}.mp4")
        mp3_path = os.path.join(output_dir, f"{video_id}.mp3")
        ks_author = (video_raw_info.get('visionVideoDetail', {}).get('author', {}).get('name', '')
                      or video_raw_info.get('visionVideoDetail', {}).get('photo', {}).get('userName', ''))
        ks_author_id = str(video_raw_info.get('visionVideoDetail', {}).get('author', {}).get('id', ''))

        # 下载封面到视频目录
        cover_url = photo_info['coverUrl']
        if cover_url and output_dir:
            try:
                resp = requests.get(
                    cover_url,
                    headers={"Referer": "https://www.kuaishou.com/"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    temp_cover = os.path.join(output_dir, "_temp_cover.jpg")
                    with open(temp_cover, "wb") as f:
                        f.write(resp.content)
                    from app.utils.video_helper import save_cover_to_video_dir
                    cover_url = save_cover_to_video_dir(
                        temp_cover, output_dir, "kuaishou", ks_author_id, video_id
                    )
                    os.remove(temp_cover)
            except Exception:
                pass

        if os.path.exists(mp3_path):
            print(f"[已存在] 跳过下载: {mp3_path}")
            return AudioDownloadResult(
                file_path=mp3_path,
                title=title,
                duration=photo_info['duration'],
                cover_url=cover_url,
                platform="kuaishou",
                video_id=video_id,
                raw_info={
                    'tags': ','.join(tag['name'] for tag in video_raw_info.get('tags', []) if tag.get('name')),
                    'owner': {'name': ks_author},
                    'uploader': ks_author,
                },
                video_path=mp4_path,
                author_id=ks_author_id,
            )

        # 下载 mp4 视频
        resp = requests.get(photo_info['photoUrl'], stream=True)
        if resp.status_code == 200:
            with open(mp4_path, "wb") as f:
                for chunk in resp.iter_content(1024 * 1024):
                    f.write(chunk)
        else:
            raise Exception(f"视频下载失败: {resp.status_code}")

        # 使用 ffmpeg 转换为 mp3
        try:
            subprocess.run([
                "ffmpeg", "-y", "-i", mp4_path, "-vn", "-acodec", "libmp3lame", mp3_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            raise Exception("ffmpeg 转换 MP3 失败")

        return AudioDownloadResult(
            file_path=mp3_path,
            title=photo_info['caption'],
            duration=photo_info['duration'],
            cover_url=cover_url,
            platform="kuaishou",
            video_id=video_id,
            raw_info={
                'tags': ','.join(tag['name'] for tag in video_raw_info.get('tags', []) if tag.get('name')),
                'owner': {'name': ks_author},
                'uploader': ks_author,
            },
            video_path=mp4_path,
            author_id=ks_author_id,
        )

    def download_video(
            self,
            video_url: str,
            output_dir: Union[str, None] = None,
    ) -> str:
        print('self.download(video_url, output_dir).video_path',self.download(video_url, output_dir).video_path)
        return self.download(video_url, output_dir).video_path


if __name__ == '__main__':
    ks = KuaiShouDownloader()
    ks.download('https://v.kuaishou.com/2vBqX74 王宝强携手刘昊然、岳云鹏上演精彩名场面 全程高能 看一遍笑一遍 "唐探1900 "快成长计划 ...更多')