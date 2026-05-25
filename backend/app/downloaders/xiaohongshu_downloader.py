"""小红书下载器 — 支持视频笔记 + 图文笔记"""
import json
import os
import re
from typing import Union, Optional
from urllib.parse import urlparse

import requests

from app.downloaders.base import Downloader
from app.downloaders.xiaohongshu_helper.signer import sign_get, sign_post
from app.enmus.note_enums import DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult
from app.services.cookie_manager import CookieConfigManager
from app.utils.logger import get_logger

logger = get_logger(__name__)

XHS_DOMAIN = "https://www.xiaohongshu.com"
XHS_NOTE_API = "https://edith.xiaohongshu.com/api/sns/web/v1/note"

cfm = CookieConfigManager()


class XiaohongshuDownloader(Downloader):
    REQUIRED_COOKIE_FIELDS = ['a1', 'web_session']

    def __init__(self, cookie=None):
        super().__init__()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Referer": "https://www.xiaohongshu.com/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }

        cookie_str = cookie if cookie else cfm.get('xiaohongshu', auto_convert=True)
        if not cookie_str:
            logger.warning("小红书 cookie 未配置，请求可能失败")
        else:
            is_valid, error_msg = cfm.validate_cookie('xiaohongshu', self.REQUIRED_COOKIE_FIELDS)
            if not is_valid:
                logger.warning(f"小红书 cookie 验证失败: {error_msg}")
            else:
                logger.info("小红书 cookie 验证成功")

        self.cookie_str = cookie_str
        if cookie_str:
            self.headers["Cookie"] = cookie_str

    def _extract_note_id(self, url: str) -> str:
        """从 URL 提取笔记 ID"""
        url = url.strip()

        # 小红书域名白名单
        XHS_ALLOWED_DOMAINS = ['xiaohongshu.com', 'www.xiaohongshu.com']

        # 处理短链接
        if 'xhslink.com' in url or '.xhslink.com' in url:
            try:
                resp = requests.head(url, headers=self.headers, allow_redirects=True, timeout=10)
                resolved_url = resp.url
                # 安全检查：验证重定向目标是否属于小红书域名
                parsed = urlparse(resolved_url)
                if parsed.hostname not in XHS_ALLOWED_DOMAINS:
                    logger.error(f"短链接重定向到非小红书域名: {parsed.hostname}")
                    return ""
                url = resolved_url
            except Exception:
                # GET 兜底
                try:
                    resp = requests.get(url, headers=self.headers, timeout=10, allow_redirects=True)
                    resolved_url = resp.url
                    parsed = urlparse(resolved_url)
                    if parsed.hostname not in XHS_ALLOWED_DOMAINS:
                        logger.error(f"短链接重定向到非小红书域名: {parsed.hostname}")
                        return ""
                    url = resolved_url
                except Exception as e:
                    logger.error(f"解析小红书短链接失败: {e}")
                    return ""

        # 从 URL 提取 note_id
        # https://www.xiaohongshu.com/explore/{note_id}
        # https://www.xiaohongshu.com/discovery/item/{note_id}
        # https://www.xiaohongshu.com/user/profile/{user_id}/{note_id}
        patterns = [
            r'xiaohongshu\.com/explore/([a-f0-9]+)',
            r'xiaohongshu\.com/discovery/item/([a-f0-9]+)',
            r'xiaohongshu\.com/user/profile/[^/]+/([a-f0-9]+)',
            r'xiaohongshu\.com/search_result.*note_id=([a-f0-9]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        # 最后尝试：URL 路径最后一段作为 note_id
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p]
        if path_parts:
            last = path_parts[-1]
            if re.match(r'^[a-f0-9]{20,30}$', last):
                return last

        return ""

    def _fetch_note_detail_page(self, note_id: str, original_url: str = None) -> Optional[dict]:
        """通过页面解析获取笔记详情（更可靠，不需要 API 签名）"""
        # 优先使用原始 URL（可能包含 xsec_token 等必要参数）
        if original_url and note_id in original_url:
            url = original_url
        else:
            url = f"{XHS_DOMAIN}/explore/{note_id}"
        try:
            # 页面请求需要携带 Cookie
            page_headers = {
                **self.headers,
                "Cookie": self.cookie_str or "",
            }
            resp = requests.get(url, headers=page_headers, timeout=15)
            logger.info(f"小红书页面请求状态码: {resp.status_code}, 响应长度: {len(resp.text)}")
            if resp.status_code != 200:
                logger.error(f"小红书页面请求失败: status={resp.status_code}")
                return None

            # 提取 __INITIAL_STATE__ - 使用更精确的正则
            # 格式通常是: <script>window.__INITIAL_STATE__={...}</script>
            match = re.search(r'__INITIAL_STATE__\s*=\s*({.+?})\s*</script>', resp.text, re.DOTALL)
            if not match:
                # 尝试另一种格式（带 undefined）
                match = re.search(r'__INITIAL_STATE__\s*=\s*(\{[^<]+\})\s*;?\s*</script>', resp.text, re.DOTALL)

            if not match:
                logger.info(f"未找到 __INITIAL_STATE__，note_id={note_id}, 响应前 500 字符: {resp.text[:500]}")
                return None

            raw_json = match.group(1)
            # 替换 JS 特有值为 JSON 兼容
            raw_json = raw_json.replace('undefined', 'null')
            data = json.loads(raw_json)

            # 从 noteDetailMap 提取笔记数据
            note_map = data.get('note', {}).get('noteDetailMap', {})
            if note_id in note_map:
                return note_map[note_id].get('note', {})

            # 取第一个 entry（note_id 可能和 URL 中的不完全一致）
            for key, val in note_map.items():
                return val.get('note', {})

            logger.error(f"页面数据中未找到笔记: note_id={note_id}, note_map keys: {list(note_map.keys())}")
            return None

        except json.JSONDecodeError as e:
            logger.error(f"解析小红书页面数据失败: {e}")
            return None
        except Exception as e:
            logger.error(f"获取小红书笔记详情失败: {e}")
            return None

    def _fetch_note_detail_api(self, note_id: str) -> Optional[dict]:
        """通过 API 获取笔记详情（备用方案，需要签名）"""
        try:
            uri = "/api/sns/web/v1/note"
            payload = {"note_id": note_id}
            sign_headers = sign_post(uri, self.cookie_str, payload)

            headers = {
                **self.headers,
                "Content-Type": "application/json;charset=UTF-8",
                "Origin": "https://www.xiaohongshu.com",
                **sign_headers,
            }

            resp = requests.post(
                f"https://edith.xiaohongshu.com{uri}",
                json=payload,
                headers=headers,
                timeout=15,
            )
            # 调试：打印响应内容前 200 字符
            logger.debug(f"小红书 API 响应状态码: {resp.status_code}, 内容前 200 字符: {resp.text[:200]}")
            if resp.status_code != 200:
                logger.error(f"小红书 API 返回非 200 状态码: {resp.status_code}")
                return None
            data = resp.json()

            if data.get("success"):
                items = data.get("data", {}).get("items", [])
                if items:
                    return items[0].get("note_card", {})
                # 新版 API 可能直接在 data 下
                note = data.get("data", {}).get("note", {})
                if note:
                    return note

            logger.error(f"小红书 API 返回错误: {data.get('msg', 'unknown')}")
            return None
        except Exception as e:
            logger.error(f"小红书 API 获取笔记详情失败: {e}")
            return None

    def _fetch_note_detail(self, note_id: str, original_url: str = None) -> Optional[dict]:
        """获取笔记详情，先尝试页面解析，失败后尝试 API"""
        note = self._fetch_note_detail_page(note_id, original_url)
        if note:
            return note
        logger.info("页面解析失败，尝试 API 方式")
        return self._fetch_note_detail_api(note_id)

    def _parse_note(self, note: dict, note_id: str) -> dict:
        """解析笔记数据，返回统一格式"""
        note_type = note.get("type", "")
        is_video = note_type == "video"
        user = note.get("user", {})
        title = note.get("title", "") or note.get("display_title", "")
        desc = note.get("desc", "")

        # 封面
        cover_url = ""
        interact = note.get("interactInfo", {})
        if interact.get("coverImageUrl"):
            cover_url = interact["coverImageUrl"]
        if not cover_url:
            image_list = note.get("imageList", [])
            if image_list:
                cover_url = image_list[0].get("urlDefault", "") or image_list[0].get("url", "")

        if not cover_url.startswith("http") and cover_url:
            cover_url = "https:" + cover_url

        # 时长
        duration = 0
        if is_video:
            video_info = note.get("video", {})
            duration = video_info.get("duration", 0) // 1000 if video_info.get("duration") else 0

        # 时间戳
        timestamp = note.get("time", 0)
        from datetime import datetime
        published_at = datetime.fromtimestamp(timestamp / 1000) if timestamp else None

        return {
            "note_id": note_id,
            "title": title or desc[:200] if desc else "",
            "desc": desc,
            "cover_url": cover_url,
            "duration": duration,
            "is_video": is_video,
            "note_type": note_type,
            "author_id": user.get("userId", ""),
            "author_name": user.get("nickname", ""),
            "avatar_url": user.get("avatar", ""),
            "published_at": published_at,
            "raw_note": note,
        }

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """获取笔记元数据"""
        note_id = self._extract_note_id(video_url)
        if not note_id:
            raise ValueError(f"无法从 URL 提取小红书笔记 ID: {video_url}")

        note = self._fetch_note_detail(note_id, video_url)
        if not note:
            raise ValueError(f"获取小红书笔记详情失败: {video_url}")

        parsed = self._parse_note(note, note_id)
        content_type = "video" if parsed["is_video"] else "article"

        # 图文：提取图片 URL 列表
        images_with_video = None
        if not parsed["is_video"]:
            image_list = note.get("imageList", [])
            image_urls = []
            for img in image_list:
                url = img.get("urlDefault", "") or img.get("url", "")
                if url and not url.startswith("http"):
                    url = "https:" + url
                if url:
                    image_urls.append(url)
            parsed["image_urls"] = image_urls

        return VideoInfoResult(
            title=parsed["title"],
            duration=parsed["duration"],
            cover_url=parsed["cover_url"],
            platform="xiaohongshu",
            video_id=note_id,
            author_id=parsed["author_id"],
            author_name=parsed["author_name"],
            description=parsed["desc"],
            content_type=content_type,
            images_with_video=images_with_video,
            raw_info={
                "content_type": content_type,
                "note_type": parsed["note_type"],
                "images": parsed.get("image_urls", []),
                "owner": {"name": parsed["author_name"]},
            },
        )

    def download(self, video_url: str, output_dir: str = None,
                 quality: DownloadQuality = "fast",
                 need_video: Optional[bool] = False) -> AudioDownloadResult:
        if output_dir is None:
            raise ValueError("output_dir 不能为空")
        os.makedirs(output_dir, exist_ok=True)

        note_id = self._extract_note_id(video_url)
        if not note_id:
            raise ValueError(f"无法从 URL 提取小红书笔记 ID: {video_url}")

        note = self._fetch_note_detail(note_id, video_url)
        if not note:
            raise ValueError(f"获取小红书笔记详情失败: {video_url}")

        parsed = self._parse_note(note, note_id)
        content_type = "video" if parsed["is_video"] else "article"

        # 图文笔记：下载所有图片
        if not parsed["is_video"]:
            image_list = note.get("imageList", [])
            downloaded_paths = []
            for i, img in enumerate(image_list):
                img_url = img.get("urlDefault", "") or img.get("url", "")
                if img_url and not img_url.startswith("http"):
                    img_url = "https:" + img_url
                if img_url:
                    ext = self._get_image_ext(img_url)
                    img_path = self._download_file(img_url, output_dir, f"image_{i + 1}{ext}")
                    if img_path:
                        downloaded_paths.append(img_path)

            cover_url = downloaded_paths[0] if downloaded_paths else parsed["cover_url"]

            return AudioDownloadResult(
                file_path=None,
                title=parsed["title"],
                duration=0,
                cover_url=cover_url,
                platform="xiaohongshu",
                video_id=note_id,
                content_type="article",
                images=downloaded_paths,
                author_id=parsed["author_id"],
                author_name=parsed["author_name"],
                description=parsed["desc"],
                raw_info={
                    "content_type": "article",
                    "images": downloaded_paths,
                    "note_type": parsed["note_type"],
                },
            )

        # 视频笔记：下载音频
        video_info = note.get("video", {})
        video_url_resolved = self._extract_video_url(video_info)
        if not video_url_resolved:
            raise ValueError("无法提取视频下载地址")

        audio_path = os.path.join(output_dir, f"{note_id}.mp3")
        self._download_file(video_url_resolved, output_dir, f"{note_id}.mp3")

        # 封面下载
        cover_url = parsed["cover_url"]
        if cover_url and output_dir:
            try:
                self._download_file(cover_url, output_dir, "_temp_cover.jpg")
                temp_cover = os.path.join(output_dir, "_temp_cover.jpg")
                if os.path.exists(temp_cover):
                    from app.utils.video_helper import save_cover_to_video_dir
                    cover_url = save_cover_to_video_dir(
                        temp_cover, output_dir, "xiaohongshu",
                        parsed["author_id"], note_id
                    )
                    os.remove(temp_cover)
            except Exception:
                pass

        duration = video_info.get("duration", 0) // 1000 if video_info.get("duration") else 0

        return AudioDownloadResult(
            file_path=audio_path,
            title=parsed["title"],
            duration=duration,
            cover_url=cover_url,
            platform="xiaohongshu",
            video_id=note_id,
            content_type="video",
            author_id=parsed["author_id"],
            author_name=parsed["author_name"],
            description=parsed["desc"],
            raw_info={
                "content_type": "video",
                "owner": {"name": parsed["author_name"]},
            },
        )

    @staticmethod
    def download_video(video_url: str, output_dir: Union[str, None] = None) -> str:
        """下载视频文件，返回 mp4 路径"""
        if output_dir is None:
            raise ValueError("output_dir 不能为空")
        os.makedirs(output_dir, exist_ok=True)

        downloader = XiaohongshuDownloader()
        note_id = downloader._extract_note_id(video_url)
        if not note_id:
            raise ValueError(f"无法提取笔记 ID: {video_url}")

        note = downloader._fetch_note_detail(note_id)
        if not note:
            raise ValueError("获取笔记详情失败")

        video_info = note.get("video", {})
        video_url_resolved = downloader._extract_video_url(video_info)
        if not video_url_resolved:
            raise ValueError("无法提取视频地址")

        output_path = os.path.join(output_dir, f"{note_id}.mp4")
        downloader._download_file(video_url_resolved, output_dir, f"{note_id}.mp4")
        return output_path

    @staticmethod
    def _extract_video_url(video_info: dict) -> str:
        """从视频信息中提取下载 URL"""
        # 优先 consumer → origin_video_stream → h264/h265
        consumer = video_info.get("consumer", {})
        origin = consumer.get("origin_video", {})
        if origin.get("url"):
            return origin["url"]

        # media → stream → h264/h265
        media = video_info.get("media", {})
        stream = media.get("stream", {})
        for codec in ["h264", "h265", "av1"]:
            streams = stream.get(codec, [])
            for s in streams:
                master_url = s.get("master_url", "") or s.get("backup_urls", [""])[0]
                if master_url:
                    return master_url

        # url 字段
        if video_info.get("url"):
            return video_info["url"]

        return ""

    @staticmethod
    def _get_image_ext(url: str) -> str:
        """从 URL 推断图片扩展名"""
        if '.png' in url:
            return '.png'
        if '.webp' in url:
            return '.webp'
        return '.jpg'

    @staticmethod
    def _download_file(url: str, output_dir: str, filename: str) -> str:
        """下载文件到指定目录"""
        # 防止路径遍历：filename 不能包含路径分隔符
        if filename != os.path.basename(filename):
            logger.warning(f"拒绝不安全的文件名: {filename}")
            return ""
        try:
            resp = requests.get(
                url,
                headers={"Referer": "https://www.xiaohongshu.com/", "User-Agent": "Mozilla/5.0"},
                timeout=30,
            )
            if resp.status_code == 200:
                # 限制文件大小（50MB）
                if len(resp.content) > 50 * 1024 * 1024:
                    logger.warning(f"文件过大，跳过: {filename} ({len(resp.content)} bytes)")
                    return ""
                path = os.path.join(output_dir, filename)
                with open(path, "wb") as f:
                    f.write(resp.content)
                return path
        except Exception as e:
            logger.warning(f"下载文件失败 ({filename}): {e}")
        return ""
