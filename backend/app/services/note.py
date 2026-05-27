import json
import logging
import os
import re
import socket
import ipaddress
import requests
import shutil
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional, Tuple, Union, Any
from urllib.parse import urlparse

from pydantic import HttpUrl
from dotenv import load_dotenv

from app.downloaders.base import Downloader
from app.db.video_task_dao import delete_task_by_video, insert_video_task, get_task_by_task_id
from app.db.user_dao import get_user_by_id
from app.enmus.exception import NoteErrorEnum, ProviderErrorEnum
from app.enmus.task_status_enums import TaskStatus
from app.enmus.note_enums import DownloadQuality
from app.exceptions.note import NoteError
from app.exceptions.provider import ProviderError
from app.gpt.base import GPT
from app.gpt.gpt_factory import GPTFactory
from app.models.audio_model import AudioDownloadResult
from app.models.gpt_model import GPTSource
from app.models.model_config import ModelConfig
from app.models.notes_model import AudioDownloadResult, NoteResult
from app.models.transcriber_model import TranscriptResult, TranscriptSegment
from app.services.constant import SUPPORT_PLATFORM_MAP
from app.services.provider import ProviderService
from app.transcriber.base import Transcriber
from app.transcriber.transcriber_provider import get_transcriber, _transcribers
from app.utils.note_helper import replace_content_markers
from app.utils.video_helper import generate_screenshot
from app.utils.video_reader import VideoReader

# ------------------ 环境变量与全局配置 ------------------

# 从 .env 文件中加载环境变量
load_dotenv()

# 后端 API 地址与端口（若有需要可以在代码其他部分使用 BACKEND_BASE_URL）
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8483")
BACKEND_BASE_URL = f"{API_BASE_URL}:{BACKEND_PORT}"

# 使用统一的路径管理工具
from app.utils.path_helper import (
    IMAGE_OUTPUT_DIR,
    IMAGE_BASE_URL,
    get_note_file_path_v2,
    get_screenshot_dir,
    get_screenshot_url_base,
    move_note_files_to_video_folder,
    VIDEO_DIR,
)

# ------------------ 安全函数 ------------------

def _is_safe_url(url: str) -> bool:
    """
    简单的 URL 安全检查，防止 SSRF 攻击。
    只检查协议和内网 IP，不依赖域名白名单。
    """
    try:
        parsed = urlparse(url)
        # 只允许 http/https
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        # 禁止本地域名
        blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
        if hostname.lower() in blocked:
            return False
        # 检查是否为内网 IP
        try:
            ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                return False
        except socket.gaierror:
            pass
        return True
    except Exception:
        return False

# 日志配置
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class NoteGenerator:
    """
    NoteGenerator 用于执行视频/音频下载、转写、GPT 生成笔记、插入截图/链接、
    以及将任务信息写入状态文件与数据库等功能。
    """

    def __init__(self):
        self.model_size: str = "base"
        self.device: Optional[str] = None
        self.transcriber_type: str = os.getenv("TRANSCRIBER_TYPE", "fast-whisper")
        self.transcriber: Transcriber = self._init_transcriber()
        self.video_path: Optional[Path] = None
        self.video_img_urls=[]
        logger.info("NoteGenerator 初始化完成")


    # ---------------- 公有方法 ----------------

    def generate(
        self,
        video_url: Union[str, HttpUrl],
        platform: str,
        quality: DownloadQuality = DownloadQuality.medium,
        task_id: Optional[str] = None,
        model_name: Optional[str] = None,
        provider_id: Optional[str] = None,
        link: bool = False,
        screenshot: bool = False,
        _format: Optional[List[str]] = None,
        style: Optional[str] = None,
        extras: Optional[str] = None,
        output_path: Optional[str] = None,
        video_understanding: bool = False,
        video_interval: int = 0,
        grid_size: Optional[List[int]] = None,
        output_language: Optional[str] = None,
        smart_mode: bool = False,
        user_id: Optional[int] = None,
    ) -> NoteResult | None:
        """
        主流程：按步骤依次下载、转写、GPT 总结、截图/链接处理、存库、返回 NoteResult。

        :param video_url: 视频或音频链接
        :param platform: 平台名称，对应 SUPPORT_PLATFORM_MAP 中的键
        :param quality: 下载音频的质量枚举
        :param task_id: 用于标识本次任务的唯一 ID，亦用于状态文件和缓存文件命名
        :param model_name: GPT 模型名称
        :param provider_id: 模型供应商 ID
        :param link: 是否在笔记中插入视频片段链接
        :param screenshot: 是否在笔记中替换 Screenshot 标记为图片
        :param _format: 包含 'link' 或 'screenshot' 等字符串的列表，决定后续处理
        :param style: GPT 生成笔记的风格
        :param extras: 额外参数，传递给 GPT
        :param output_path: 下载输出目录（可选）
        :param video_understanding: 是否需要视频拼图理解（生成缩略图）
        :param video_interval: 视频帧截取间隔（秒），仅在 video_understanding 为 True 时生效
        :param grid_size: 生成缩略图时的网格大小，如 [3, 3]
        :return: NoteResult 对象，包含 markdown 文本、转写结果和音频元信息
        """
        if grid_size is None:
            grid_size = []

        try:
            logger.info(f"开始生成笔记 (task_id={task_id}, smart_mode={smart_mode})")

            # 重试场景：先从数据库获取已存的 author 信息
            from app.db.video_task_dao import get_task_by_task_id
            existing_task = get_task_by_task_id(task_id)
            existing_author_id = existing_task.author_id if existing_task else None
            existing_author_name = existing_task.author_name if existing_task else None
            existing_video_id = existing_task.video_id if existing_task else None
            existing_platform = existing_task.platform if existing_task else ""
            existing_title = existing_task.title if existing_task else None

            self._update_status(task_id, TaskStatus.PARSING,
                                author_id=existing_author_id, author_name=existing_author_name,
                                video_id=existing_video_id, title=existing_title, platform=existing_platform)

            # 获取下载器
            downloader = self._get_downloader(platform)

            # 非智能模式：提前获取 GPT 实例
            gpt = None
            if not smart_mode:
                gpt = self._get_gpt(model_name, provider_id)

            # 预获取视频信息（不下载文件），用于确定三级目录
            video_info = None
            try:
                video_info = downloader.get_video_info(str(video_url))
                logger.info(f"预获取视频信息: video_id={video_info.video_id}, author_id={video_info.author_id}")
            except Exception as e:
                logger.warning(f"预获取视频信息失败，将在下载后确定路径: {e}")

            # 根据预获取的信息确定三级目录路径
            author_id = video_info.author_id if video_info else None
            author_name = video_info.author_name if video_info else None
            video_id = video_info.video_id if video_info else None
            _title = video_info.title if video_info else None

            # 本地文件特殊处理：使用当前用户作为作者
            if platform in ("local", "local_audio") and not author_id and user_id:
                user = get_user_by_id(user_id)
                if user:
                    author_id = str(user.id)
                    author_name = user.username
                video_id = _title

            if author_id:
                # 直接使用三级目录路径
                audio_cache_file = get_note_file_path_v2(
                    task_id, author_id, author_name, video_id, _title, "audio", platform
                )
                transcript_cache_file = get_note_file_path_v2(
                    task_id, author_id, author_name, video_id, _title, "transcript", platform
                )
                markdown_cache_file = get_note_file_path_v2(
                    task_id, author_id, author_name, video_id, _title, "markdown", platform
                )
                # 媒体文件直接下载到三级目录
                if not output_path:
                    from app.utils.path_helper import get_video_folder
                    output_path = str(get_video_folder(author_id, author_name, video_id, _title, platform))
            else:
                # 使用 _pending 临时目录
                pending_dir = VIDEO_DIR / "_pending" / task_id
                pending_dir.mkdir(parents=True, exist_ok=True)
                output_path = str(pending_dir)
                audio_cache_file = pending_dir / "audio.json"
                transcript_cache_file = pending_dir / "transcript.json"
                markdown_cache_file = pending_dir / "note.md"

            # 检测图集/实况照片内容：跳过下载和转写，直接生成图文笔记
            if video_info and getattr(video_info, 'content_type', 'video') in ('article', 'live_photo'):
                logger.info(f"检测到图集内容 (content_type={video_info.content_type})，走图文笔记流程")
                self._update_status(task_id, TaskStatus.DOWNLOADING,
                                    author_id=author_id, author_name=author_name,
                                    video_id=video_id, title=_title, platform=platform)

                # 下载图片到输出目录
                image_urls = video_info.raw_info.get('images', [])
                local_images = []
                cover_api_url = None
                if output_path and image_urls:
                    os.makedirs(output_path, exist_ok=True)
                    for i, img_url in enumerate(image_urls):
                        try:
                            if not _is_safe_url(img_url):
                                logger.warning(f"跳过不安全的图片 URL: {img_url[:80]}")
                                continue
                            referer_map = {
                                "douyin": "https://www.douyin.com/",
                                "xiaohongshu": "https://www.xiaohongshu.com/",
                            }
                            referer = referer_map.get(platform, "https://www.douyin.com/")
                            resp = requests.get(img_url, headers={"Referer": referer}, timeout=15)
                            if resp.status_code == 200:
                                img_path = os.path.join(output_path, f"image_{i+1}.jpg")
                                with open(img_path, "wb") as f:
                                    f.write(resp.content)
                                local_images.append(img_path)
                        except Exception as e:
                            logger.warning(f"下载图集图片 {i+1} 失败: {e}")

                    # 保存第一张图作为封面
                    if local_images:
                        from app.utils.video_helper import save_cover_to_video_dir
                        try:
                            cover_api_url = save_cover_to_video_dir(
                                local_images[0], output_path, platform, author_id, video_id
                            )
                        except Exception:
                            cover_api_url = None

                # 实况照片：下载视频文件（检测 images_with_video 数据而非 content_type）
                live_photo_video_urls = []
                _images_with_video = video_info.raw_info.get('images_with_video') or getattr(video_info, 'images_with_video', None)
                if _images_with_video and output_path:
                    os.makedirs(output_path, exist_ok=True)
                    for i, item in enumerate(_images_with_video):
                        vid_url = item.get('video_url')
                        if vid_url:
                            if not _is_safe_url(vid_url):
                                logger.warning(f"跳过不安全的实况照片 URL: {vid_url[:80]}")
                                continue
                            live_photo_video_urls.append(vid_url)
                            try:
                                referer = referer_map.get(platform, "https://www.douyin.com/")
                                resp = requests.get(vid_url, headers={"Referer": referer}, timeout=30)
                                if resp.status_code == 200:
                                    vid_path = os.path.join(output_path, f"live_photo_{i+1}.mp4")
                                    with open(vid_path, "wb") as f:
                                        f.write(resp.content)
                                    logger.info(f"实况照片视频已下载: {vid_path}")
                            except Exception as e:
                                logger.warning(f"下载实况照片视频 {i+1} 失败: {e}")
                    logger.info(f"实况照片共下载 {len(live_photo_video_urls)} 个视频")

                self._update_status(task_id, TaskStatus.SUMMARIZING,
                                    author_id=author_id, author_name=author_name,
                                    video_id=video_id, title=_title, platform=platform)

                # 调用图文笔记生成
                markdown, smart_info = self.generate_article_note(
                    title=_title or "",
                    author=author_name or "",
                    description=video_info.description or "",
                    images=[url for url in image_urls],
                    live_photo_videos=live_photo_video_urls if live_photo_video_urls else None,
                    model_name=model_name,
                    provider_id=provider_id,
                    smart_mode=smart_mode,
                    user_id=user_id,
                )

                if output_path:
                    note_path = os.path.join(output_path, "note.md")
                    os.makedirs(os.path.dirname(note_path), exist_ok=True)
                    with open(note_path, "w", encoding="utf-8") as f:
                        f.write(markdown)

                # 提取 AI 标签并清理 markdown 中的标记
                from app.gpt.prompt_builder import extract_ai_tags, remove_ai_tags_marker
                ai_tags = extract_ai_tags(markdown)
                if ai_tags:
                    markdown = remove_ai_tags_marker(markdown)
                    logger.info(f"图文笔记提取到 AI 标签: {ai_tags}")

                self._update_status(task_id, TaskStatus.SUCCESS,
                                    author_id=author_id, author_name=author_name,
                                    video_id=video_id, title=_title, platform=platform)

                # 图文笔记成功后，保存元数据到数据库
                if task_id and video_id:
                    try:
                        import json
                        from app.db.video_task_dao import update_task_metadata
                        platform_tags = video_info.tags if hasattr(video_info, 'tags') and video_info.tags else []
                        existing_task = get_task_by_task_id(task_id)
                        existing_tags = json.loads(existing_task.tags) if existing_task and existing_task.tags else {}
                        existing_manual = existing_tags.get("manual_tags", [])
                        existing_ai = existing_tags.get("ai_tags", [])

                        final_ai_tags = ai_tags or existing_ai or []

                        tags_json = json.dumps({
                            "platform_tags": platform_tags,
                            "ai_tags": final_ai_tags,
                            "manual_tags": existing_manual,
                        })
                        update_task_metadata(
                            task_id=task_id,
                            title=_title,
                            author=author_name or "",
                            author_id=author_id,
                            author_name=author_name,
                            cover_url=cover_api_url,
                            tags=tags_json,
                        )
                        logger.info(f"图文笔记元数据已保存: task_id={task_id}")
                    except Exception as e:
                        logger.error(f"保存图文笔记元数据失败: {e}")

                result_kwargs = dict(
                    markdown=markdown,
                    task_id=task_id,
                    title=_title,
                    author_id=author_id,
                    author_name=author_name,
                    video_id=video_id,
                    platform=platform,
                    content_type=video_info.content_type,
                )
                if smart_info:
                    result_kwargs.update(
                        smart_switched=smart_info.get("switched", False),
                        used_model_name=f"{smart_info.get('provider_name', '')}/{smart_info.get('model_name', '')}",
                        used_provider_name=smart_info.get("provider_name", ""),
                    )

                return NoteResult(**result_kwargs)

            # 1. 下载音频/视频
            audio_meta = self._download_media(
                downloader=downloader,
                video_url=video_url,
                quality=quality,
                audio_cache_file=audio_cache_file,
                status_phase=TaskStatus.DOWNLOADING,
                platform=platform,
                output_path=output_path,
                screenshot=screenshot,
                video_understanding=video_understanding,
                video_interval=video_interval,
                grid_size=grid_size,
                task_id=task_id,
                author_id=author_id,
                author_name=author_name,
            )

            # 下载完成后保存元数据
            self._save_audio_metadata(task_id=task_id, audio_meta=audio_meta)

            # 如果预获取失败，下载后重新确定三级路径
            if not author_id:
                author_id = audio_meta.author_id if hasattr(audio_meta, 'author_id') else None
                author_name = audio_meta.author_name if hasattr(audio_meta, 'author_name') else None
                if audio_meta.raw_info:
                    owner = audio_meta.raw_info.get("owner", {})
                    _author = owner.get("name", "") if owner else ""
                    if not _author:
                        _author = audio_meta.raw_info.get("uploader", "")
                    if not _author:
                        _author = audio_meta.raw_info.get("channel", "")
                    if not author_id:
                        if owner:
                            author_id = str(owner.get("mid", "")) or str(owner.get("uid", "")) or None
                        if not author_id:
                            author_id = audio_meta.raw_info.get("channel_id") or audio_meta.raw_info.get("uploader_id")
                            if author_id:
                                author_id = str(author_id)
                    if not author_name:
                        author_name = _author if _author else None
                video_id = audio_meta.video_id
                _title = audio_meta.title

                # 迁移临时文件到三级目录
                if author_id:
                    try:
                        move_note_files_to_video_folder(
                            task_id=task_id, author_id=author_id, author_name=author_name,
                            video_id=video_id, title=_title, platform=platform,
                        )
                        transcript_cache_file = get_note_file_path_v2(
                            task_id, author_id, author_name, video_id, _title, "transcript", platform
                        )
                        markdown_cache_file = get_note_file_path_v2(
                            task_id, author_id, author_name, video_id, _title, "markdown", platform
                        )
                        logger.info(f"已迁移到三级目录 (author_id={author_id}, video_id={video_id})")
                    except Exception as e:
                        logger.warning(f"迁移三级目录失败，继续使用临时路径: {e}")
            else:
                # 预获取成功，更新 audio_meta 中的路径（如果需要）
                video_id = audio_meta.video_id
                _title = audio_meta.title

            # 2. 转写文字
            transcript = self._transcribe_audio(
                audio_file=audio_meta.file_path,
                transcript_cache_file=transcript_cache_file,
                status_phase=TaskStatus.TRANSCRIBING,
                task_id=task_id,
            )

            # 3. GPT 总结
            smart_result = None
            if smart_mode and user_id:
                # 智能优选模式：使用 SmartModelSelector 进行重试
                markdown, smart_result = self._summarize_with_smart_mode(
                    audio_meta=audio_meta,
                    transcript=transcript,
                    markdown_cache_file=markdown_cache_file,
                    link=link,
                    screenshot=screenshot,
                    formats=_format or [],
                    style=style,
                    extras=extras,
                    video_img_urls=self.video_img_urls,
                    output_language=output_language,
                    user_id=user_id,
                    task_id=task_id,
                )
            else:
                # 普通模式：直接调用 GPT
                markdown = self._summarize_text(
                    audio_meta=audio_meta,
                    transcript=transcript,
                    gpt=gpt,
                    markdown_cache_file=markdown_cache_file,
                    link=link,
                    screenshot=screenshot,
                    formats=_format or [],
                    style=style,
                    extras=extras,
                    video_img_urls=self.video_img_urls,
                    output_language=output_language,
                    task_id=task_id,
                )

            # 4. 截图 & 链接替换
            if _format:
                markdown = self._post_process_markdown(
                    markdown=markdown,
                    video_path=self.video_path,
                    formats=_format,
                    audio_meta=audio_meta,
                    platform=platform,
                )

            # 4.5 提取 AI 标签并清理 markdown 中的标记
            from app.gpt.prompt_builder import extract_ai_tags, remove_ai_tags_marker
            ai_tags = extract_ai_tags(markdown)
            if ai_tags:
                markdown = remove_ai_tags_marker(markdown)
                logger.info(f"提取到 AI 标签: {ai_tags}")

            # 5. 保存记录到数据库
            self._update_status(task_id, TaskStatus.SAVING,
                                title=_title, author_id=author_id, author_name=author_name,
                                video_id=video_id, platform=platform)
            self._save_metadata(video_id=audio_meta.video_id, platform=platform, task_id=task_id, video_url=str(video_url))
            # 保存视频元数据到数据库
            self._save_audio_metadata(task_id=task_id, audio_meta=audio_meta, ai_tags=ai_tags)

            # 6. 完成
            self._update_status(task_id, TaskStatus.SUCCESS,
                                title=_title, author_id=author_id, author_name=author_name,
                                video_id=video_id, platform=platform)
            logger.info(f"笔记生成成功 (task_id={task_id})")

            # 清理 _pending 临时目录
            _pending_dir = VIDEO_DIR / "_pending" / task_id
            if _pending_dir.exists():
                shutil.rmtree(_pending_dir)
                logger.info(f"已清理 _pending 目录: {_pending_dir}")

            result_kwargs = dict(
                markdown=markdown,
                transcript=transcript,
                audio_meta=audio_meta,
                model_name=model_name,
                style=style,
            )

            # 智能优选模式下附加模型信息
            if smart_result:
                result_kwargs.update(
                    smart_switched=smart_result.switched,
                    used_model_id=smart_result.model_id,
                    used_model_name=f"{smart_result.provider_name}/{smart_result.model_name}",
                    used_provider_name=smart_result.provider_name,
                    model_name=smart_result.model_name,
                )

            return NoteResult(**result_kwargs)

        except Exception as exc:
            logger.error(f"生成笔记流程异常 (task_id={task_id})：{exc}", exc_info=True)
            self._update_status(task_id, TaskStatus.FAILED, message=str(exc),
                                title=_title, author_id=author_id, author_name=author_name,
                                video_id=video_id, platform=platform)
            return None

    def generate_article_note(self, title: str, author: str, description: str,
                              images: list = None, live_photo_videos: list = None,
                              model_name: str = None,
                              provider_id: str = None, smart_mode: bool = False,
                              user_id: int = None) -> Tuple[str, Optional[dict]]:
        """
        从图文内容直接生成笔记（跳过下载和转写）

        :return: (markdown, smart_info) 其中 smart_info 包含实际使用的模型信息
        """
        from app.gpt.prompt import ARTICLE_SUMMARY_PROMPT

        image_text = ""
        if images:
            image_text = "\n\n图片链接：\n" + "\n".join(f"- {img}" for img in images)

        # 实况照片视频提示
        if live_photo_videos:
            video_urls = [v for v in live_photo_videos if v]
            if video_urls:
                image_text += "\n\n实况照片视频链接：\n" + "\n".join(f"- {v}" for v in video_urls)
                image_text += "\n（以上为实况照片的动态视频片段，共 {} 个，请在笔记中提及动态效果）".format(len(video_urls))

        prompt = ARTICLE_SUMMARY_PROMPT.format(
            title=title,
            author=author or "未知",
            description=description or "",
            image_count=len(images) if images else 0,
            image_text=image_text,
        )

        # 智能优选模式
        if smart_mode and user_id:
            from app.services.smart_selector import SmartModelSelector, SmartSelectionError

            selector = SmartModelSelector(user_id)
            # 创建一个简单的 GPTSource 用于智能选择器
            # 注意：图文笔记不使用标准的 GPTSource，而是直接 chat
            try:
                # 获取排序后的模型，逐个尝试
                sorted_models = selector.get_sorted_models()
                if not sorted_models:
                    return "智能优选失败：没有可用的模型", None

                for model_info in sorted_models[:3]:  # 最多尝试 3 个
                    model_id = model_info["model_id"]
                    actual_provider_id = model_info["provider_id"]

                    try:
                        gpt = self._get_gpt(model_info["model_name"], actual_provider_id)
                        result = gpt.chat(prompt)

                        if result and len(result) > 100:
                            # 记录成功
                            from app.db.model_usage_history_dao import record_usage
                            record_usage(user_id, model_id, actual_provider_id, True)

                            return result, {
                                "model_name": model_info["model_name"],
                                "provider_name": model_info["provider_name"],
                                "switched": model_info != sorted_models[0],
                            }
                    except Exception as e:
                        # 记录失败
                        from app.db.model_usage_history_dao import record_usage
                        record_usage(user_id, model_id, actual_provider_id, False,
                                     selector._classify_error(e))
                        logger.warning(f"智能优选图文笔记失败 (model={model_info['model_name']}): {e}")
                        continue

                return "智能优选失败：所有模型尝试均失败", None
            except Exception as e:
                logger.error(f"智能优选图文笔记异常: {e}")
                return f"智能优选异常: {e}", None

        # 普通模式：直接使用指定模型
        gpt = self._get_gpt(model_name, provider_id)
        result = gpt.chat(prompt)
        return result, None

    @staticmethod
    def delete_note(video_id: str, platform: str) -> int:
        """
        删除数据库中对应 video_id 与 platform 的任务记录

        :param video_id: 视频 ID
        :param platform: 平台标识
        :return: 删除的记录数
        """
        logger.info(f"删除笔记记录 (video_id={video_id}, platform={platform})")
        return delete_task_by_video(video_id, platform)

    # ---------------- 私有方法 ----------------

    def _init_transcriber(self) -> Transcriber:
        """
        根据环境变量 TRANSCRIBER_TYPE 动态获取并实例化转写器
        """
        if self.transcriber_type not in _transcribers:
            logger.error(f"未找到支持的转写器：{self.transcriber_type}")
            raise Exception(f"不支持的转写器：{self.transcriber_type}")

        logger.info(f"使用转写器：{self.transcriber_type}")
        return get_transcriber(transcriber_type=self.transcriber_type)

    def _get_gpt(self, model_name: Optional[str], provider_id: Optional[str]) -> GPT:
        """
        根据 provider_id 获取对应的 GPT 实例
        :param model_name: GPT 模型名称
        :param provider_id: 供应商 ID
        :return: GPT 实例
        """
        provider = ProviderService.get_provider_by_id(provider_id)
        if not provider:
            logger.error(f"[get_gpt] 未找到模型供应商: provider_id={provider_id}")
            raise ProviderError(code=ProviderErrorEnum.NOT_FOUND,message=ProviderErrorEnum.NOT_FOUND.message)
        logger.info(f"创建 GPT 实例 {provider_id}")
        config = ModelConfig(
            api_key=provider["api_key"],
            base_url=provider["base_url"],
            model_name=model_name,
            provider=provider["type"],
            name=provider["name"],
        )
        return GPTFactory().from_config(config)

    def _get_downloader(self, platform: str) -> Downloader:
        """
        根据平台名称获取对应的下载器实例

        :param platform: 平台标识，需在 SUPPORT_PLATFORM_MAP 中
        :return: 对应的 Downloader 子类实例
        """
        downloader_cls = SUPPORT_PLATFORM_MAP.get(platform)
        logger.debug(f"实例化下载器 -  {platform}")
        instance = None
        if not downloader_cls:
            logger.error(f"不支持的平台：{platform}")
            raise NoteError(code=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.code,
                            message=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.message)
        try:
            instance = downloader_cls
        except Exception as e:
            logger.error(f"实例化下载器失败：{e}")


        logger.info(f"使用下载器：{downloader_cls.__class__}")
        return instance

    def _update_status(self, task_id: Optional[str], status: Union[str, TaskStatus],
                       message: Optional[str] = None, title: Optional[str] = None,
                       author_id: Optional[str] = None, author_name: Optional[str] = None,
                       video_id: Optional[str] = None, platform: str = ""):
        """
        创建或更新状态文件，记录当前任务状态

        :param task_id: 任务唯一 ID
        :param status: TaskStatus 枚举或自定义状态字符串
        :param message: 可选消息，用于记录失败原因等
        :param title: 笔记标题
        :param author_id: 博主唯一 ID（用于三级路径）
        :param author_name: 博主名称
        :param video_id: 视频 ID
        :param platform: 平台标识
        """
        if not task_id:
            return

        # 如果没有 author_id，尝试从数据库获取已有任务的作者信息
        if not author_id:
            try:
                from app.db.video_task_dao import get_task_by_task_id
                db_task = get_task_by_task_id(task_id)
                if db_task:
                    author_id = db_task.author_id
                    author_name = db_task.author_name
                    video_id = video_id or db_task.video_id
                    title = title or db_task.title
                    platform = platform or db_task.platform
            except Exception:
                pass

        status_file = get_note_file_path_v2(
            task_id, author_id, author_name, video_id, title, "status", platform
        )
        print(f"写入状态文件: {status_file} 当前状态: {status}")
        data = {"status": status.value if isinstance(status, TaskStatus) else status}
        if message:
            data["message"] = message

        try:
            # Ensure parent directory exists
            status_file.parent.mkdir(parents=True, exist_ok=True)
            # First create a temporary file
            temp_file = status_file.with_suffix('.tmp')

            # Write to temporary file
            with temp_file.open('w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            # Atomic rename operation
            temp_file.replace(status_file)

            print(f"状态文件写入成功: {status_file}")
        except Exception as e:
            logger.error(f"写入状态文件失败 (task_id={task_id})：{e}")
            # Try to write error to file directly as fallback
            try:
                with status_file.open('w', encoding='utf-8') as f:
                    f.write(f"Error writing status: {str(e)}")
            except Exception:
                logger.error(f"写入错误  {e}")

    def _handle_exception(self, task_id, exc):
        logger.error(f"任务异常 (task_id={task_id})", exc_info=True)
        error_message = getattr(exc, 'detail', str(exc))
        if isinstance(error_message, dict):
            try:
                error_message = json.dumps(error_message, ensure_ascii=False)
            except Exception:
                error_message = str(error_message)
        self._update_status(task_id, TaskStatus.FAILED, message=error_message)

    def _download_media(
        self,
        downloader: Downloader,
        video_url: Union[str, HttpUrl],
        quality: DownloadQuality,
        audio_cache_file: Path,
        status_phase: TaskStatus,
        platform: str,
        output_path: Optional[str],
        screenshot: bool,
        video_understanding: bool,
        video_interval: int,
        grid_size: List[int],
        task_id: Optional[str] = None,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
    ) -> AudioDownloadResult | None:
        """
        1. 检查音频缓存；若不存在，则根据需要下载音频或视频（若需截图/可视化）。
        2. 如果需要视频，则并行下载视频和音频，提升效率。
        3. 返回 AudioDownloadResult

        :param downloader: Downloader 实例
        :param video_url: 视频/音频链接
        :param quality: 音频下载质量
        :param audio_cache_file: 本地缓存 JSON 文件路径
        :param status_phase: 对应的状态枚举，如 TaskStatus.DOWNLOADING
        :param platform: 平台标识
        :param output_path: 下载输出目录（可为 None）
        :param screenshot: 是否需要在笔记中插入截图
        :param video_understanding: 是否需要生成缩略图
        :param video_interval: 视频截帧间隔
        :param grid_size: 缩略图网格尺寸
        :return: AudioDownloadResult 对象
        """
        if task_id:
            self._update_status(task_id, status_phase)

        # 判断是否需要下载视频
        need_video = screenshot or video_understanding

        # 已有音频缓存，直接加载
        if audio_cache_file.exists():
            logger.info(f"检测到音频缓存 ({audio_cache_file})，直接读取")
            try:
                data = json.loads(audio_cache_file.read_text(encoding="utf-8"))
                audio_meta = AudioDownloadResult(**data)

                # 不需要视频，直接返回缓存的音频
                if not need_video:
                    return audio_meta

                # 需要视频，检查视频是否已缓存（使用 video_id 查找）
                _author_name = None
                if audio_meta.raw_info:
                    owner = audio_meta.raw_info.get("owner", {})
                    _author_name = owner.get("name", "") if owner else ""
                    if not _author_name:
                        _author_name = audio_meta.raw_info.get("uploader", "")
                    if not _author_name:
                        _author_name = audio_meta.raw_info.get("channel", "")

                if self._check_video_cached(
                    audio_meta.video_id,
                    author_id=audio_meta.author_id,
                    author_name=_author_name,
                    title=audio_meta.title,
                    platform=audio_meta.platform,
                ):
                    logger.info("视频已缓存，跳过下载")
                    self._restore_cached_video(
                        audio_meta.video_id, grid_size, video_interval,
                        author_id=audio_meta.author_id,
                        author_name=_author_name,
                        title=audio_meta.title,
                        platform=audio_meta.platform,
                    )
                    return audio_meta

                # 音频有缓存但视频没有，只下载视频
                logger.info("音频已缓存，仅下载视频")
                try:
                    video_result = downloader.download_video(video_url, output_path)
                    if video_result:
                        self.video_path = Path(video_result)
                        logger.info(f"视频下载完成：{self.video_path}")
                        if grid_size:
                            try:
                                self.video_img_urls = VideoReader(
                                    video_path=str(self.video_path),
                                    grid_size=tuple(grid_size),
                                    frame_interval=video_interval,
                                    unit_width=1280,
                                    unit_height=720,
                                    save_quality=90,
                                ).run()
                            except Exception as exc:
                                logger.warning(f"缩略图生成失败：{exc}")
                                self.video_img_urls = []
                    else:
                        logger.warning("视频下载返回为空")
                except Exception as exc:
                    logger.warning(f"视频下载失败（不影响音频缓存）：{exc}")

                return audio_meta

            except Exception as e:
                logger.warning(f"读取音频缓存失败，将重新下载：{e}")

        # 无缓存，并行下载视频和音频
        if need_video:
            return self._parallel_download(
                downloader=downloader,
                video_url=video_url,
                quality=quality,
                audio_cache_file=audio_cache_file,
                task_id=task_id,
                output_path=output_path,
                grid_size=grid_size,
                video_interval=video_interval,
                author_id=author_id,
                author_name=author_name,
            )

        # 单独下载音频（保持原有逻辑）
        try:
            logger.info("开始下载音频")
            audio = downloader.download(
                video_url=str(video_url),
                quality=quality,
                output_dir=output_path,
                need_video=False,
            )
            audio_cache_file.parent.mkdir(parents=True, exist_ok=True)
            audio_cache_file.write_text(json.dumps(asdict(audio), ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info(f"音频下载并缓存成功 ({audio_cache_file})")
            return audio
        except Exception as exc:
            logger.error(f"音频下载失败：{exc}")
            self._handle_exception(task_id, exc)
            raise

    def _check_video_cached(
        self,
        video_id: str,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
        title: Optional[str] = None,
        platform: str = "",
    ) -> bool:
        """
        检查视频是否已缓存（在三级目录中查找）

        :param video_id: 视频ID（如 BV号、数字ID）
        :param author_id: 博主唯一 ID
        :param author_name: 博主名称
        :param title: 视频标题
        :param platform: 平台标识
        """
        if not author_id:
            return False

        from app.utils.path_helper import get_video_folder, sanitize_path_name
        video_folder = get_video_folder(author_id, author_name, video_id, title, platform)
        for ext in [".mp4", ".mkv", ".webm"]:
            candidate = video_folder / f"{sanitize_path_name(video_id or 'video')}{ext}"
            if candidate.exists():
                return True
        return False

    def _restore_cached_video(
        self,
        video_id: str,
        grid_size: List[int],
        video_interval: int,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
        title: Optional[str] = None,
        platform: str = "",
    ):
        """从缓存中恢复视频路径和缩略图（在三级目录中查找）

        :param video_id: 视频ID（如 BV号、数字ID）
        :param grid_size: 缩略图网格大小
        :param video_interval: 视频帧截取间隔
        :param author_id: 博主唯一 ID
        :param author_name: 博主名称
        :param title: 视频标题
        :param platform: 平台标识
        """
        if not author_id:
            logger.warning("无法恢复视频缓存：缺少 author_id")
            return

        from app.utils.path_helper import get_video_folder, sanitize_path_name
        video_folder = get_video_folder(author_id, author_name, video_id, title, platform)
        for ext in [".mp4", ".mkv", ".webm"]:
            candidate = video_folder / f"{sanitize_path_name(video_id or 'video')}{ext}"
            if candidate.exists():
                self.video_path = candidate
                logger.info(f"恢复视频缓存路径：{self.video_path}")
                break

        if grid_size and self.video_path:
            try:
                self.video_img_urls = VideoReader(
                    video_path=str(self.video_path),
                    grid_size=tuple(grid_size),
                    frame_interval=video_interval,
                    unit_width=1280,
                    unit_height=720,
                    save_quality=90,
                ).run()
            except Exception as exc:
                logger.warning(f"缩略图生成失败：{exc}")
                self.video_img_urls = []

    def _parallel_download(
        self,
        downloader: Downloader,
        video_url: Union[str, HttpUrl],
        quality: DownloadQuality,
        audio_cache_file: Path,
        task_id: str,
        output_path: Optional[str],
        grid_size: List[int],
        video_interval: int,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
    ) -> AudioDownloadResult:
        """
        并行下载视频和音频，使用 asyncio.gather 提升效率

        :param downloader: Downloader 实例
        :param video_url: 视频/音频链接
        :param quality: 音频下载质量
        :param audio_cache_file: 音频缓存文件路径
        :param task_id: 任务 ID
        :param output_path: 输出目录
        :param grid_size: 缩略图网格尺寸
        :param video_interval: 视频截帧间隔
        :return: AudioDownloadResult 对象
        """
        import concurrent.futures

        # 使用 ThreadPoolExecutor 并行执行同步下载任务
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            # 提交视频下载任务
            video_future = executor.submit(
                downloader.download_video,
                video_url,
                output_path,
            )

            # 提交音频下载任务
            audio_future = executor.submit(
                downloader.download,
                video_url,
                output_path,
                quality,
                True,  # need_video
            )

            # 等待两个任务完成，处理结果
            video_result = None
            audio_result = None

            try:
                # 先获取视频下载结果（用于生成缩略图）
                video_result = video_future.result()
                if video_result:
                    self.video_path = Path(video_result)
                    logger.info(f"视频下载完成：{self.video_path}")

                    # 生成缩略图
                    if grid_size:
                        try:
                            self.video_img_urls = VideoReader(
                                video_path=str(self.video_path),
                                grid_size=tuple(grid_size),
                                frame_interval=video_interval,
                                unit_width=1280,
                                unit_height=720,
                                save_quality=90,
                            ).run()
                        except Exception as exc:
                            logger.warning(f"缩略图生成失败：{exc}")
                            self.video_img_urls = []
                    else:
                        logger.info("未指定 grid_size，跳过缩略图生成")
            except Exception as exc:
                logger.error(f"视频下载失败：{exc}")
                # 视频下载失败不阻塞音频下载，继续等待音频结果

            try:
                # 获取音频下载结果
                audio_result = audio_future.result()
                audio_cache_file.parent.mkdir(parents=True, exist_ok=True)
                audio_cache_file.write_text(
                    json.dumps(asdict(audio_result), ensure_ascii=False, indent=2),
                    encoding="utf-8"
                )
                logger.info(f"音频下载并缓存成功 ({audio_cache_file})")
            except Exception as exc:
                logger.error(f"音频下载失败：{exc}")
                self._handle_exception(task_id, exc)
                raise

            # 如果视频下载失败但音频成功，仍返回音频结果
            if audio_result:
                return audio_result

            # 两者都失败
            self._handle_exception(task_id, Exception("视频和音频下载均失败"))
            raise NoteError(code=NoteErrorEnum.DOWNLOAD_FAILED, message="下载失败")


    def _transcribe_audio(
        self,
        audio_file: str,
        transcript_cache_file: Path,
        status_phase: TaskStatus,
        task_id: Optional[str] = None,
    ) -> TranscriptResult | None:
        """
        1. 检查转写缓存；若存在则尝试加载，否则调用转写器生成并缓存。
        2. 返回 TranscriptResult 对象

        :param audio_file: 音频文件本地路径
        :param transcript_cache_file: 转写结果缓存路径
        :param status_phase: 对应的状态枚举，如 TaskStatus.TRANSCRIBING
        :param task_id: 任务 ID
        :return: TranscriptResult 对象
        """
        if task_id:
            self._update_status(task_id, status_phase)

        # 已有缓存，尝试加载
        if transcript_cache_file.exists():
            logger.info(f"检测到转写缓存 ({transcript_cache_file})，尝试读取")
            try:
                data = json.loads(transcript_cache_file.read_text(encoding="utf-8"))
                segments = [TranscriptSegment(**seg) for seg in data.get("segments", [])]
                return TranscriptResult(language=data["language"], full_text=data["full_text"], segments=segments)
            except Exception as e:
                logger.warning(f"加载转写缓存失败，将重新转写：{e}")

        # 调用转写器
        try:
            logger.info("开始转写音频")
            transcript = self.transcriber.transcript(file_path=audio_file)
            transcript_cache_file.parent.mkdir(parents=True, exist_ok=True)
            transcript_cache_file.write_text(json.dumps(asdict(transcript), ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info(f"转写并缓存成功 ({transcript_cache_file})")
            return transcript
        except Exception as exc:
            logger.error(f"音频转写失败：{exc}")
            self._handle_exception(task_id, exc)
            raise

    def _summarize_text(
        self,
        audio_meta: AudioDownloadResult,
        transcript: TranscriptResult,
        gpt: GPT,
        markdown_cache_file: Path,
        link: bool,
        screenshot: bool,
        formats: List[str],
        style: Optional[str],
        extras: Optional[str],
            video_img_urls: List[str],
            output_language: Optional[str] = None,
            task_id: Optional[str] = None,
    ) -> str | None:
        """
        调用 GPT 对转写结果进行总结，生成 Markdown 文本并缓存。

        :param audio_meta: AudioDownloadResult 元信息
        :param transcript: TranscriptResult 转写结果
        :param gpt: GPT 实例
        :param markdown_cache_file: Markdown 缓存路径
        :param link: 是否在笔记中插入链接
        :param screenshot: 是否在笔记中生成截图占位
        :param formats: 包含 'link' 或 'screenshot' 的列表
        :param style: GPT 输出风格
        :param extras: GPT 额外参数
        :return: 生成的 Markdown 字符串
        """
        if task_id:
            self._update_status(task_id, TaskStatus.SUMMARIZING)
        logger.info(f"GPT output_language: {output_language}")

        # style=raw 时，跳过 GPT，直接输出转写原文
        if style == 'raw':
            markdown = self._generate_raw_markdown(audio_meta, transcript, formats)
            markdown_cache_file.parent.mkdir(parents=True, exist_ok=True)
            markdown_cache_file.write_text(markdown, encoding="utf-8")
            logger.info(f"原文模式，跳过 GPT，直接缓存 ({markdown_cache_file})")
            return markdown

        source = GPTSource(
            title=audio_meta.title,
            segment=transcript.segments,
            tags=audio_meta.tags if audio_meta.tags else [],
            screenshot=screenshot,
            video_img_urls=video_img_urls,
            link=link,
            _format=formats,
            style=style,
            extras=extras,
            output_language=output_language,
        )

        try:
            markdown = gpt.summarize(source)
            markdown_cache_file.parent.mkdir(parents=True, exist_ok=True)
            markdown_cache_file.write_text(markdown, encoding="utf-8")
            logger.info(f"GPT 总结并缓存成功 ({markdown_cache_file})")
            return markdown
        except Exception as exc:
            logger.error(f"GPT 总结失败：{exc}")
            self._handle_exception(task_id, exc)
            raise

    def _summarize_with_smart_mode(
        self,
        audio_meta,
        transcript,
        markdown_cache_file: Path,
        link: bool,
        screenshot: bool,
        formats: List[str],
        style: Optional[str],
        extras: Optional[str],
        video_img_urls: List[str],
        output_language: Optional[str],
        user_id: int,
        task_id: str,
    ) -> Tuple[str, Any]:
        """
        智能优选模式下的 GPT 总结，支持模型自动切换重试

        :return: (markdown, SmartSelectionResult)
        """
        from app.services.smart_selector import SmartModelSelector, SmartSelectionError

        self._update_status(task_id, TaskStatus.SUMMARIZING)

        # raw 模式不需要 GPT
        if style == 'raw':
            markdown = self._generate_raw_markdown(audio_meta, transcript, formats)
            markdown_cache_file.parent.mkdir(parents=True, exist_ok=True)
            markdown_cache_file.write_text(markdown, encoding="utf-8")
            return markdown, None

        source = GPTSource(
            title=audio_meta.title,
            segment=transcript.segments,
            tags=audio_meta.tags if audio_meta.tags else [],
            screenshot=screenshot,
            video_img_urls=video_img_urls,
            link=link,
            _format=formats,
            style=style,
            extras=extras,
            output_language=output_language,
        )

        selector = SmartModelSelector(user_id)

        try:
            result = selector.summarize_with_retry(source, task_id)
            markdown_cache_file.parent.mkdir(parents=True, exist_ok=True)
            markdown_cache_file.write_text(result.markdown, encoding="utf-8")
            logger.info(
                f"智能优选 GPT 总结成功 ({markdown_cache_file}), "
                f"使用模型: {result.provider_name}/{result.model_name}, "
                f"切换: {result.switched}"
            )
            return result.markdown, result
        except SmartSelectionError as e:
            logger.error(f"智能优选全部失败: {e.message}")
            self._update_status(task_id, TaskStatus.FAILED, message=e.message)
            raise

    def _generate_raw_markdown(
        self,
        audio_meta: AudioDownloadResult,
        transcript: TranscriptResult,
        formats: List[str],
    ) -> str:
        """
        将转写原文直接拼接为 Markdown 格式（不做任何总结）。

        :param audio_meta: 音频元信息
        :param transcript: 转写结果
        :param formats: 格式列表（用于添加时间戳跳转）
        :return: Markdown 字符串
        """
        lines = [f"# {audio_meta.title or '转写原文'}\n\n"]
        lines.append("> 本笔记为转写原文，未经过 AI 总结。\n\n")

        for segment in transcript.segments:
            minutes = int(segment.start // 60)
            seconds = int(segment.start % 60)
            timestamp = f"[{minutes:02d}:{seconds:02d}]"
            text = segment.text.strip()
            if text:
                lines.append(f"{timestamp} {text}\n\n")

        return "".join(lines)

    def _post_process_markdown(
        self,
        markdown: str,
        video_path: Optional[Path],
        formats: List[str],
        audio_meta: AudioDownloadResult,
        platform: str,
    ) -> str:
        """
        对生成的 Markdown 做后期处理：插入截图和/或插入链接。

        :param markdown: 原始 Markdown 字符串
        :param video_path: 本地视频路径（可为 None）
        :param formats: 包含 'link' 或 'screenshot' 的列表
        :param audio_meta: AudioDownloadResult 元信息，用于链接替换
        :param platform: 平台标识，用于链接替换
        :return: 处理后的 Markdown 字符串
        """
        if "screenshot" in formats and video_path:
            try:
                markdown = self._insert_screenshots(
                    markdown, video_path, audio_meta, platform
                )
            except Exception as exc:
                logger.warning("截图插入失败，跳过该步骤")

        if "link" in formats:
            try:
                markdown = replace_content_markers(markdown, video_id=audio_meta.video_id, platform=platform)
            except Exception as e:
                logger.warning(f"链接插入失败，跳过该步骤：{e}")

        return markdown

    def _insert_screenshots(self, markdown: str, video_path: Path,
                            audio_meta: AudioDownloadResult, platform: str) -> str | None | Any:
        """
        扫描 Markdown 文本中所有 Screenshot 标记，并替换为实际生成的截图链接。
        """
        author_id = audio_meta.author_id if hasattr(audio_meta, 'author_id') else None
        author_name = audio_meta.author_name if hasattr(audio_meta, 'author_name') else None
        video_id = audio_meta.video_id
        title = audio_meta.title

        ss_dir = str(get_screenshot_dir(author_id, author_name, video_id, title, platform))
        ss_url_base = get_screenshot_url_base(author_id or "", video_id, platform)

        matches: List[Tuple[str, int]] = self._extract_screenshot_timestamps(markdown)
        for idx, (marker, ts) in enumerate(matches):
            try:
                img_path = generate_screenshot(str(video_path), ss_dir, ts, idx)
                img_path_obj = Path(img_path)
                if not img_path_obj.exists():
                    logger.warning(f"截图文件未生成，跳过 (timestamp={ts})")
                    continue
                filename = img_path_obj.name
                img_url = f"{ss_url_base}/{filename}"
                markdown = markdown.replace(marker, f"![]({img_url})", 1)
            except Exception as exc:
                logger.error(f"生成截图失败 (timestamp={ts})：{exc}")
                continue
        return markdown

    @staticmethod
    def _extract_screenshot_timestamps(markdown: str) -> List[Tuple[str, int]]:
        """
        从 Markdown 文本中提取所有 '*Screenshot-mm:ss' 或 'Screenshot-[mm:ss]' 标记，
        返回 [(原始标记文本, 时间戳秒数), ...] 列表。

        :param markdown: 原始 Markdown 文本
        :return: 标记与对应时间戳秒数的列表
        """
        pattern = r"\*Screenshot-\[?(\d{2}):(\d{2})\]?"
        results: List[Tuple[str, int]] = []
        for match in re.finditer(pattern, markdown):
            mm = match.group(1)
            ss = match.group(2)
            total_seconds = int(mm) * 60 + int(ss)
            results.append((match.group(0), total_seconds))
        return results

    def _save_metadata(self, video_id: str, platform: str, task_id: str, video_url: str = None) -> None:
        """
        将生成的笔记任务记录插入数据库

        :param video_id: 视频 ID
        :param platform: 平台标识
        :param task_id: 任务 ID
        :param video_url: 视频链接
        """
        try:
            insert_video_task(video_id=video_id, platform=platform, task_id=task_id, video_url=video_url)
            logger.info(f"已保存任务记录到数据库 (video_id={video_id}, platform={platform}, task_id={task_id})")
        except Exception as e:
            logger.error(f"保存任务记录失败：{e}")

    @staticmethod
    def _save_audio_metadata(task_id: str, audio_meta, ai_tags: list = None) -> None:
        """将音频/视频元数据更新到数据库"""
        try:
            import json
            from app.db.video_task_dao import update_task_metadata
            author = ""
            author_id = audio_meta.author_id if hasattr(audio_meta, 'author_id') else None
            author_name = getattr(audio_meta, 'author_name', None)
            if audio_meta.raw_info:
                owner = audio_meta.raw_info.get("owner", {})
                author = owner.get("name", "") if owner else ""
                if not author:
                    author = audio_meta.raw_info.get("uploader", "")
                if not author:
                    author = audio_meta.raw_info.get("channel", "")
                # 如果下载器没提取 author_id，尝试从 raw_info 提取
                if not author_id:
                    if owner:
                        author_id = str(owner.get("mid", "")) or str(owner.get("uid", "")) or None
                    if not author_id:
                        author_id = audio_meta.raw_info.get("channel_id") or audio_meta.raw_info.get("uploader_id")
                        if author_id:
                            author_id = str(author_id)
                if not author_name:
                    author_name = author if author else None

            # 构建标签 JSON（保留已有 manual_tags 和 ai_tags）
            platform_tags = audio_meta.tags if hasattr(audio_meta, 'tags') and audio_meta.tags else []
            existing_task = get_task_by_task_id(task_id)
            existing_tags = json.loads(existing_task.tags) if existing_task and existing_task.tags else {}
            existing_manual = existing_tags.get("manual_tags", [])
            existing_ai = existing_tags.get("ai_tags", [])

            # 直接使用新生成的 AI 标签，或保留已有标签
            final_ai_tags = ai_tags or existing_ai or []

            tags_json = json.dumps({
                "platform_tags": platform_tags,
                "ai_tags": final_ai_tags,
                "manual_tags": existing_manual  # 保留手动添加的标签
            })

            update_task_metadata(
                task_id=task_id,
                title=audio_meta.title,
                cover_url=audio_meta.cover_url,
                duration=audio_meta.duration,
                author=author,
                description=audio_meta.description,
                author_id=author_id,
                author_name=author_name,
                tags=tags_json,
            )
            logger.info(f"已保存元数据 (task_id={task_id}, author_id={author_id})")
        except Exception as e:
            logger.error(f"保存元数据失败: {e}")
            raise