import json
import logging
import os
import re
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional, Tuple, Union, Any

from fastapi import HTTPException
from pydantic import HttpUrl
from dotenv import load_dotenv

from app.downloaders.base import Downloader
from app.downloaders.bilibili_downloader import BilibiliDownloader
from app.downloaders.douyin_downloader import DouyinDownloader
from app.downloaders.local_downloader import LocalDownloader
from app.downloaders.youtube_downloader import YoutubeDownloader
from app.db.video_task_dao import delete_task_by_video, insert_video_task
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
from app.utils.status_code import StatusCode
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
    NOTE_OUTPUT_DIR,
    IMAGE_OUTPUT_DIR,
    IMAGE_BASE_URL,
    get_note_file_path,
    get_media_file_path,
    MEDIA_DIR,
)

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
            self._update_status(task_id, TaskStatus.PARSING)

            # 获取下载器
            downloader = self._get_downloader(platform)

            # 非智能模式：提前获取 GPT 实例
            gpt = None
            if not smart_mode:
                gpt = self._get_gpt(model_name, provider_id)

            # 缓存文件路径（暂时不使用标题，因为下载前还没有标题）
            audio_cache_file = get_note_file_path(task_id, None, "audio")
            transcript_cache_file = get_note_file_path(task_id, None, "transcript")
            markdown_cache_file = get_note_file_path(task_id, None, "markdown")
            print(audio_cache_file)
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
            )

            # 下载完成后立即保存元数据（封面图等），避免后续步骤失败导致封面丢失
            self._save_audio_metadata(task_id=task_id, audio_meta=audio_meta)

            # 2. 转写文字
            transcript = self._transcribe_audio(
                audio_file=audio_meta.file_path,
                transcript_cache_file=transcript_cache_file,
                status_phase=TaskStatus.TRANSCRIBING,
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

            # 5. 保存记录到数据库
            self._update_status(task_id, TaskStatus.SAVING)
            self._save_metadata(video_id=audio_meta.video_id, platform=platform, task_id=task_id, video_url=str(video_url))
            # 保存视频元数据到数据库
            self._save_audio_metadata(task_id=task_id, audio_meta=audio_meta)

            # 6. 完成
            self._update_status(task_id, TaskStatus.SUCCESS)
            logger.info(f"笔记生成成功 (task_id={task_id})")

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
            self._update_status(task_id, TaskStatus.FAILED, message=str(exc))
            return None

    def generate_article_note(self, title: str, author: str, description: str,
                              images: list = None, model_name: str = None,
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

    def _update_status(self, task_id: Optional[str], status: Union[str, TaskStatus], message: Optional[str] = None, title: Optional[str] = None):
        """
        创建或更新状态文件，记录当前任务状态

        :param task_id: 任务唯一 ID
        :param status: TaskStatus 枚举或自定义状态字符串
        :param message: 可选消息，用于记录失败原因等
        :param title: 笔记标题（可选，用于确定文件夹）
        """
        if not task_id:
            return

        status_file = get_note_file_path(task_id, title, "status")
        print(f"写入状态文件: {status_file} 当前状态: {status}")
        data = {"status": status.value if isinstance(status, TaskStatus) else status}
        if message:
            data["message"] = message

        try:
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
            except:
                logger.error(f"写入错误  {e}")

    def _handle_exception(self, task_id, exc):
        logger.error(f"任务异常 (task_id={task_id})", exc_info=True)
        error_message = getattr(exc, 'detail', str(exc))
        if isinstance(error_message, dict):
            try:
                error_message = json.dumps(error_message, ensure_ascii=False)
            except:
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
        task_id = audio_cache_file.stem.split("_")[0]
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

                # 需要视频，检查视频是否已缓存
                if self._check_video_cached(task_id):
                    logger.info("视频已缓存，跳过下载")
                    self._restore_cached_video(task_id, grid_size, video_interval)
                    return audio_meta

                # 音频有缓存但视频没有，只下载视频
                logger.info("音频已缓存，仅下载视频")
                try:
                    video_result = downloader.download_video(video_url, None)
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
            )

        # 单独下载音频（保持原有逻辑）
        try:
            logger.info("开始下载音频")
            audio = downloader.download(
                video_url=video_url,
                quality=quality,
                output_dir=output_path,
                need_video=False,
            )
            audio_cache_file.write_text(json.dumps(asdict(audio), ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info(f"音频下载并缓存成功 ({audio_cache_file})")
            return audio
        except Exception as exc:
            logger.error(f"音频下载失败：{exc}")
            self._handle_exception(task_id, exc)
            raise

    def _check_video_cached(self, task_id: str) -> bool:
        """
        检查视频是否已缓存（通过检查视频文件是否存在）
        """
        # 检查媒体目录中的视频文件
        video_patterns = [
            get_media_file_path(task_id, "video", "mp4"),
            get_media_file_path(task_id, "video", "mkv"),
            get_media_file_path(task_id, "video", "webm"),
        ]
        return any(p.exists() for p in video_patterns)

    def _restore_cached_video(self, task_id: str, grid_size: List[int], video_interval: int):
        """从缓存中恢复视频路径和缩略图"""
        video_patterns = [
            get_media_file_path(task_id, "video", "mp4"),
            get_media_file_path(task_id, "video", "mkv"),
            get_media_file_path(task_id, "video", "webm"),
        ]
        for p in video_patterns:
            if p.exists():
                self.video_path = p
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
                None,  # output_dir
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
    ) -> TranscriptResult | None:
        """
        1. 检查转写缓存；若存在则尝试加载，否则调用转写器生成并缓存。
        2. 返回 TranscriptResult 对象

        :param audio_file: 音频文件本地路径
        :param transcript_cache_file: 转写结果缓存路径
        :param status_phase: 对应的状态枚举，如 TaskStatus.TRANSCRIBING
        :return: TranscriptResult 对象
        """
        task_id = transcript_cache_file.stem.split("_")[0]
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
        task_id = markdown_cache_file.stem
        self._update_status(task_id, TaskStatus.SUMMARIZING)
        logger.info(f"GPT output_language: {output_language}")

        # style=raw 时，跳过 GPT，直接输出转写原文
        if style == 'raw':
            markdown = self._generate_raw_markdown(audio_meta, transcript, formats)
            markdown_cache_file.write_text(markdown, encoding="utf-8")
            logger.info(f"原文模式，跳过 GPT，直接缓存 ({markdown_cache_file})")
            return markdown

        source = GPTSource(
            title=audio_meta.title,
            segment=transcript.segments,
            tags=audio_meta.raw_info.get("tags", []),
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
            markdown_cache_file.write_text(markdown, encoding="utf-8")
            return markdown, None

        source = GPTSource(
            title=audio_meta.title,
            segment=transcript.segments,
            tags=audio_meta.raw_info.get("tags", []),
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
                markdown = self._insert_screenshots(markdown, video_path)
            except Exception as exc:
                logger.warning("截图插入失败，跳过该步骤")

        if "link" in formats:
            try:
                markdown = replace_content_markers(markdown, video_id=audio_meta.video_id, platform=platform)
            except Exception as e:
                logger.warning(f"链接插入失败，跳过该步骤：{e}")

        return markdown

    def _insert_screenshots(self, markdown: str, video_path: Path) -> str | None | Any:
        """
        扫描 Markdown 文本中所有 Screenshot 标记，并替换为实际生成的截图链接。

        :param markdown: 含有 *Screenshot-mm:ss 或 Screenshot-[mm:ss] 标记的 Markdown 文本
        :param video_path: 本地视频文件路径
        :return: 替换后的 Markdown 字符串
        """
        matches: List[Tuple[str, int]] = self._extract_screenshot_timestamps(markdown)
        for idx, (marker, ts) in enumerate(matches):
            try:
                img_path = generate_screenshot(str(video_path), str(IMAGE_OUTPUT_DIR), ts, idx)
                filename = Path(img_path).name
                # 构建前端可访问的 URL，例如 /static/screenshots/{filename}
                img_url = f"{IMAGE_BASE_URL.rstrip('/')}/{filename}"
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
    def _save_audio_metadata(task_id: str, audio_meta) -> None:
        """将音频/视频元数据更新到数据库"""
        try:
            from app.db.video_task_dao import update_task_metadata
            author = ""
            if audio_meta.raw_info:
                owner = audio_meta.raw_info.get("owner", {})
                author = owner.get("name", "") if owner else ""
                if not author:
                    author = audio_meta.raw_info.get("uploader", "")
                if not author:
                    author = audio_meta.raw_info.get("channel", "")
            update_task_metadata(
                task_id=task_id,
                title=audio_meta.title,
                cover_url=audio_meta.cover_url,
                duration=audio_meta.duration,
                author=author,
            )
            logger.info(f"已保存元数据到数据库 (task_id={task_id}, title={audio_meta.title})")
        except Exception as e:
            logger.error(f"保存元数据失败：{e}")