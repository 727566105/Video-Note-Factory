import json
import re
import shutil
import requests
from pathlib import Path
from datetime import datetime
from app.utils.logger import get_logger
from app.db.obsidian_config_dao import get_config, get_decrypted_config, get_decrypted_key
from app.db.obsidian_export_history_dao import add_export_record
from app.utils.path_helper import find_note_file, get_video_folder
from app.db.video_task_dao import get_task_by_task_id

logger = get_logger(__name__)


class ObsidianExporter:
    """Obsidian 导出服务，支持本地 Vault 写入和 Local REST API 推送"""

    def __init__(self, config=None):
        """
        Args:
            config: 配置对象（可选）。不传时从数据库读取并自动解密 API Key；
                    传入时直接使用 config.api_key（视为明文）。
        """
        if config is None:
            self.config = get_decrypted_config()
            if self.config is None:
                # 无配置或解密失败，仅 local 模式可能可用（后续 export_note 会校验）
                self.config = get_config()
            # 优先使用解密后的 key，回退到 get_decrypted_key() 单独获取
            self._api_key = getattr(self.config, '_decrypted_key', None) if self.config else None
            if self._api_key is None and self.config:
                self._api_key = get_decrypted_key()
        else:
            self.config = config
            self._api_key = config.api_key

    def export_note(self, task_id: str, content_sections: dict = None, title: str = None):
        """
        导出笔记到 Obsidian

        Args:
            task_id: videoNote 任务 ID
            content_sections: 内容选择（预留，暂未实现分段导出）
            title: 笔记标题（可选）

        Returns:
            dict: 包含导出路径和模式
        """
        try:
            # 读取任务信息
            task = get_task_by_task_id(task_id)
            if not task:
                raise FileNotFoundError(f"任务不存在: {task_id}")

            # 读取 Markdown 内容（优先 note.json 的 markdown 字段，回退 note.md）
            markdown_content = self._read_markdown(task_id, task)
            if not markdown_content.strip():
                raise ValueError("笔记内容为空")

            # 适配 Markdown 内容
            adapted_content = self._adapt_markdown(markdown_content)

            # 生成标题
            doc_title = title or getattr(task, 'title', None) or f"笔记_{task_id[:8]}"

            # 生成 YAML frontmatter
            frontmatter = self._build_frontmatter(task)

            # 组合最终内容
            final_content = frontmatter + "\n" + adapted_content

            # 根据 export_mode 执行导出
            if self.config is None:
                raise ValueError("Obsidian 未配置，请先在设置中配置 Obsidian")
            export_mode = self.config.export_mode or "local"
            if export_mode == "local":
                result = self._export_local(final_content, doc_title, task_id, task)
            else:
                result = self._export_api(final_content, doc_title, task_id, task)

            # 记录导出历史
            add_export_record(
                task_id=task_id,
                export_mode=export_mode,
                file_path=result.get("file_path", ""),
                status="success"
            )

            logger.info(f"Obsidian 导出成功: task_id={task_id}, mode={export_mode}")
            return result

        except FileNotFoundError as e:
            logger.error(f"笔记文件不存在: {e}")
            add_export_record(task_id=task_id, export_mode=self._safe_export_mode(),
                              status="failed", error_message=str(e))
            raise
        except ValueError as e:
            logger.error(f"笔记内容无效: {e}")
            add_export_record(task_id=task_id, export_mode=self._safe_export_mode(),
                              status="failed", error_message=str(e))
            raise
        except Exception as e:
            logger.error(f"导出笔记到 Obsidian 失败: task_id={task_id}, error: {e}")
            add_export_record(task_id=task_id, export_mode=self._safe_export_mode(),
                              status="failed", error_message=str(e))
            raise

    def _read_markdown(self, task_id: str, task) -> str:
        """读取笔记 Markdown 内容，优先 note.json，回退 note.md"""
        markdown_content = ""

        # 优先从 note.json 读取 markdown 字段
        note_json_file = find_note_file(
            task_id,
            author_id=getattr(task, 'author_id', None),
            author_name=getattr(task, 'author_name', None),
            video_id=getattr(task, 'video_id', None),
            title=getattr(task, 'title', None),
            file_type="note",
            platform=getattr(task, 'platform', '') or "",
            user_id=getattr(task, 'user_id', None)
        )
        if note_json_file and note_json_file.exists():
            try:
                note_data = json.loads(note_json_file.read_text(encoding="utf-8"))
                markdown_content = note_data.get("markdown", "")
            except Exception as e:
                logger.warning(f"读取 note.json 失败: {e}")

        # 回退到 note.md 文件
        if not markdown_content.strip():
            markdown_file = find_note_file(
                task_id,
                author_id=getattr(task, 'author_id', None),
                author_name=getattr(task, 'author_name', None),
                video_id=getattr(task, 'video_id', None),
                title=getattr(task, 'title', None),
                file_type="markdown",
                platform=getattr(task, 'platform', '') or ""
            )
            if markdown_file and markdown_file.exists():
                markdown_content = markdown_file.read_text(encoding="utf-8")

        return markdown_content

    def _build_frontmatter(self, task) -> str:
        """生成 YAML frontmatter"""
        from app.utils.path_helper import DATA_DIR

        # 解析 tags
        tags_str = ""
        tags_data = getattr(task, 'tags', None)
        if tags_data:
            try:
                tags_obj = json.loads(tags_data) if isinstance(tags_data, str) else tags_data
                all_tags = []
                if isinstance(tags_obj, dict):
                    all_tags.extend(tags_obj.get("platform_tags", []))
                    all_tags.extend(tags_obj.get("ai_tags", []))
                elif isinstance(tags_obj, list):
                    all_tags = tags_obj
                if all_tags:
                    # YAML 数组格式
                    platform = getattr(task, 'platform', '') or ''
                    if platform and platform not in all_tags:
                        all_tags.insert(0, platform)
                    tags_str = "\n".join(f"  - {t}" for t in all_tags)
            except Exception:
                pass

        # 读取 note.json 获取 model/provider/style/content_type 信息（合并为一次读取）
        model_name = ""
        provider_name = ""
        style = ""
        content_type = "video"
        note_json_file = find_note_file(
            getattr(task, 'task_id', ''),
            author_id=getattr(task, 'author_id', None),
            author_name=getattr(task, 'author_name', None),
            video_id=getattr(task, 'video_id', None),
            title=getattr(task, 'title', None),
            file_type="note",
            platform=getattr(task, 'platform', '') or "",
            user_id=getattr(task, 'user_id', None)
        )
        if note_json_file and note_json_file.exists():
            try:
                note_data = json.loads(note_json_file.read_text(encoding="utf-8"))
                model_name = note_data.get("used_model_name", "") or note_data.get("model_name", "")
                provider_name = note_data.get("used_provider_name", "")
                style = note_data.get("style", "") or getattr(task, 'note_style', '') or ""
                content_type = note_data.get("content_type", "video")
            except Exception:
                pass

        # 构建 source URL
        source = getattr(task, 'video_url', '') or ''

        # duration（防御非数值类型）
        duration = getattr(task, 'duration', None)

        # 组装 frontmatter
        lines = ["---"]
        lines.append(f'title: "{_yaml_escape(getattr(task, "title", "") or "")}"')
        lines.append(f'author: "{_yaml_escape(getattr(task, "author_name", "") or getattr(task, "author", "") or "")}"')
        lines.append(f'platform: "{getattr(task, "platform", "") or ""}"')
        if source:
            lines.append(f'source: "{_yaml_escape(source)}"')
        video_id = getattr(task, 'video_id', '') or ''
        if video_id:
            lines.append(f'video_id: "{video_id}"')
        if duration is not None:
            try:
                lines.append(f'duration: {int(duration)}')
            except (ValueError, TypeError):
                pass
        lines.append(f'content_type: "{content_type}"')
        if tags_str:
            lines.append("tags:")
            lines.append(tags_str)
        if model_name:
            lines.append(f'model: "{_yaml_escape(model_name)}"')
        if provider_name:
            lines.append(f'provider: "{_yaml_escape(provider_name)}"')
        if style:
            lines.append(f'style: "{_yaml_escape(style)}"')
        lines.append(f'videonote_id: "{getattr(task, "task_id", "")}"')
        lines.append(f'exported_at: "{datetime.now().isoformat()}"')
        lines.append("---")

        return "\n".join(lines)

    def _export_local(self, markdown: str, title: str, task_id: str, task) -> dict:
        """直接写入 Vault 文件系统"""
        vault_path = Path(self.config.vault_path).expanduser().resolve()
        folder_path = self.config.folder_path or "videoNote/"
        attachments_folder = self.config.attachments_folder or "attachments/"

        # 安全校验：确保 vault_path 是合法目录且可写
        if not vault_path.exists():
            raise FileNotFoundError(f"Vault 路径不存在: {vault_path}")
        if not vault_path.is_dir():
            raise ValueError(f"Vault 路径不是目录: {vault_path}")

        # 确保目标目录存在，并校验路径遍历风险
        target_dir = (vault_path / folder_path).resolve()
        try:
            target_dir.relative_to(vault_path)
        except ValueError:
            raise ValueError(f"目标文件夹路径超出 Vault 范围: {folder_path}")
        target_dir.mkdir(parents=True, exist_ok=True)

        # 附件目录同样校验
        attachments_dir = (target_dir / attachments_folder).resolve()
        try:
            attachments_dir.relative_to(vault_path)
        except ValueError:
            raise ValueError(f"附件目录路径超出 Vault 范围: {attachments_folder}")
        attachments_dir.mkdir(parents=True, exist_ok=True)
        markdown = self._process_images(markdown, task_id, task, attachments_dir)

        # 处理视频：复制到附件目录 + 在末尾嵌入 <video> 标签
        markdown = self._process_video_local(markdown, task, attachments_dir)

        # 写入 Markdown 文件
        safe_title = _safe_filename(title)
        file_path = target_dir / f"{safe_title}.md"
        file_path.write_text(markdown, encoding="utf-8")

        # 自动配置 Obsidian 附件目录（让 Wikilink 图片能被识别）
        attachment_folder_setting = f"{folder_path}{attachments_folder}".rstrip('/')
        config_msg = self._ensure_obsidian_config_local(vault_path, attachment_folder_setting)

        logger.info(f"Obsidian 本地写入成功: {file_path}")
        return {
            "export_mode": "local",
            "file_path": str(file_path),
            "vault_path": str(vault_path),
            "folder_path": folder_path,
            "config_hint": config_msg,
        }

    def _export_api(self, markdown: str, title: str, task_id: str, task) -> dict:
        """通过 Local REST API 推送到 Obsidian"""
        api_url = self.config.api_url.rstrip('/')
        folder_path = self.config.folder_path or "videoNote/"
        attachments_folder = self.config.attachments_folder or "attachments/"

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "text/markdown"
        }

        # 处理图片：先上传到 Vault 附件目录
        # API 模式下，图片需要逐个上传
        markdown = self._process_images_api(markdown, task_id, task, api_url, folder_path, attachments_folder, headers)

        # 处理视频：上传到 Vault 附件目录 + 在末尾嵌入 <video> 标签
        markdown = self._process_video_api(markdown, task, api_url, folder_path, attachments_folder, headers)

        # 推送 Markdown 文件
        safe_title = _safe_filename(title)
        md_path = f"{folder_path}{safe_title}.md"

        response = requests.put(
            f"{api_url}/vault/{md_path}",
            headers=headers,
            data=markdown.encode("utf-8"),
            timeout=30
        )

        if response.status_code not in (200, 201, 204):
            error_msg = f"API 返回错误: {response.status_code} {response.text[:200]}"
            logger.error(error_msg)
            raise Exception(error_msg)

        # 自动配置 Obsidian 附件目录（让 Wikilink 图片能被识别）
        attachment_folder_setting = f"{folder_path}{attachments_folder}".rstrip('/')
        config_msg = self._ensure_obsidian_config_api(api_url, headers, attachment_folder_setting)

        logger.info(f"Obsidian API 推送成功: {md_path}")
        return {
            "export_mode": "api",
            "file_path": md_path,
            "api_url": api_url,
            "folder_path": folder_path,
            "config_hint": config_msg,
        }

    def _find_video_file(self, task) -> Path | None:
        """查找视频文件（mp4/ webm），返回本地路径"""
        try:
            video_folder = get_video_folder(
                author_id=getattr(task, 'author_id', '') or '',
                author_name=getattr(task, 'author_name', '') or '',
                video_id=getattr(task, 'video_id', '') or '',
                title=getattr(task, 'title', '') or '',
                platform=getattr(task, 'platform', '') or ''
            )
            if not video_folder:
                return None
            # 查找视频文件（优先 mp4）
            for ext in ('.mp4', '.webm', '.mov', '.mkv'):
                files = list(video_folder.glob(f'*{ext}'))
                if files:
                    return files[0]
            return None
        except Exception as e:
            logger.warning(f"查找视频文件失败: {e}")
            return None

    def _process_video_local(self, markdown: str, task, attachments_dir: Path) -> str:
        """本地模式：复制视频到附件目录 + 在笔记末尾嵌入 <video> 标签"""
        video_path = self._find_video_file(task)
        if not video_path or not video_path.exists():
            logger.info("未找到视频文件，跳过视频嵌入")
            return markdown

        try:
            attachments_dir.mkdir(parents=True, exist_ok=True)
            # 使用 video_id 作为文件名前缀，避免冲突
            video_id = getattr(task, 'video_id', '') or 'video'
            dest_filename = f"{video_id}{video_path.suffix}"
            dest_path = attachments_dir / dest_filename

            # 复制视频文件（覆盖同名）
            shutil.copy2(str(video_path), str(dest_path))
            logger.info(f"视频已复制到 Vault: {dest_path}")

            # 在笔记末尾追加视频嵌入（Obsidian 原生支持 ![[video.mp4]] Wikilink）
            video_embed = f"\n\n## 视频原片\n\n![[{dest_filename}]]\n"
            return markdown + video_embed
        except Exception as e:
            logger.warning(f"复制视频失败（不影响导出）: {e}")
            return markdown

    def _process_video_api(self, markdown: str, task,
                            api_url: str, folder_path: str, attachments_folder: str,
                            headers: dict) -> str:
        """API 模式：上传视频到 Vault + 在笔记末尾嵌入 <video> 标签"""
        video_path = self._find_video_file(task)
        if not video_path or not video_path.exists():
            logger.info("未找到视频文件，跳过视频嵌入")
            return markdown

        try:
            video_id = getattr(task, 'video_id', '') or 'video'
            dest_filename = f"{video_id}{video_path.suffix}"
            attachment_path = f"{folder_path}{attachments_folder}{dest_filename}"

            # 上传视频文件
            upload_headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/octet-stream"
            }
            with open(video_path, 'rb') as f:
                resp = requests.put(
                    f"{api_url}/vault/{attachment_path}",
                    headers=upload_headers,
                    data=f.read(),
                    timeout=120  # 视频文件可能较大，超时设长一些
                )
            if resp.status_code in (200, 201, 204):
                logger.info(f"视频已通过 API 上传: {attachment_path}")
                video_embed = f"\n\n## 视频原片\n\n![[{dest_filename}]]\n"
                return markdown + video_embed
            else:
                logger.warning(f"API 上传视频失败: {resp.status_code} {resp.text[:200]}")
                return markdown
        except Exception as e:
            logger.warning(f"API 上传视频失败（不影响导出）: {e}")
            return markdown

    def _ensure_obsidian_config_local(self, vault_path: Path, attachment_folder: str) -> str:
        """本地模式：写入/更新 Vault 的 .obsidian/app.json，配置附件目录

        Obsidian 默认在 Vault 根目录找附件，导致 Wikilink 图片无法显示。
        设置 attachmentFolderPath 后，Obsidian 能识别子目录里的附件。

        Returns:
            配置提示信息（用于前端展示）
        """
        try:
            obsidian_dir = vault_path / ".obsidian"
            obsidian_dir.mkdir(parents=True, exist_ok=True)
            app_json_path = obsidian_dir / "app.json"

            # 读取现有配置（如有）
            existing = {}
            if app_json_path.exists():
                try:
                    import json as _json
                    existing = _json.loads(app_json_path.read_text(encoding="utf-8"))
                except Exception:
                    existing = {}

            # attachmentFolderPath 已正确配置则跳过
            if existing.get("attachmentFolderPath") == attachment_folder:
                return ""

            # 写入/更新配置
            import json as _json
            existing["attachmentFolderPath"] = attachment_folder
            # newFileLocation: 1 = 当前文件夹子目录（配合 attachmentFolderPath）
            existing.setdefault("newFileLocation", 1)
            app_json_path.write_text(
                _json.dumps(existing, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            logger.info(f"Obsidian 附件目录配置已写入: {app_json_path} -> {attachment_folder}")
            return f"已自动配置 Obsidian 附件目录为 {attachment_folder}，请在 Obsidian 中重新打开笔记查看图片"
        except Exception as e:
            logger.warning(f"配置 Obsidian app.json 失败（不影响导出）: {e}")
            return "请在 Obsidian 设置 → 文件与链接 → 附件默认存放位置，设置为 videoNote/attachments"

    def _ensure_obsidian_config_api(self, api_url: str, headers: dict, attachment_folder: str) -> str:
        """API 模式：通过 REST API 写入 .obsidian/app.json

        Returns:
            配置提示信息（用于前端展示）
        """
        try:
            app_json_path = ".obsidian/app.json"

            # 先读取现有配置
            resp = requests.get(
                f"{api_url}/vault/{app_json_path}",
                headers=headers,
                timeout=10
            )

            existing = {}
            if resp.status_code == 200:
                try:
                    existing = resp.json()
                except Exception:
                    existing = {}

            # attachmentFolderPath 已正确配置则跳过
            if existing.get("attachmentFolderPath") == attachment_folder:
                return ""

            # 写入/更新配置
            import json as _json
            existing["attachmentFolderPath"] = attachment_folder
            existing.setdefault("newFileLocation", 1)
            new_content = _json.dumps(existing, indent=2, ensure_ascii=False)

            put_resp = requests.put(
                f"{api_url}/vault/{app_json_path}",
                headers={**headers, "Content-Type": "text/plain"},
                data=new_content.encode("utf-8"),
                timeout=10
            )

            if put_resp.status_code in (200, 201, 204):
                logger.info(f"Obsidian 附件目录配置已通过 API 写入: {attachment_folder}")
                return f"已自动配置 Obsidian 附件目录为 {attachment_folder}，请在 Obsidian 中重新打开笔记查看图片"
            else:
                logger.warning(f"API 写入 app.json 返回 {put_resp.status_code}")
                return "请在 Obsidian 设置 → 文件与链接 → 附件默认存放位置，设置为 videoNote/attachments"
        except Exception as e:
            logger.warning(f"通过 API 配置 Obsidian app.json 失败（不影响导出）: {e}")
            return "请在 Obsidian 设置 → 文件与链接 → 附件默认存放位置，设置为 videoNote/attachments"

    def _process_images(self, markdown: str, task_id: str, task, attachments_dir: Path) -> str:
        """处理图片：复制到附件目录 + 替换为 Obsidian Wikilink 格式

        支持的图片引用格式：
        - ![](/api/video_screenshots/{platform}/{author_id}/{video_id}/{filename})
        - ![](/api/note_media_file/{platform}/{author_id}/{video_id}/{filename})
        - ![](/api/image_proxy?url=...)
        """
        # 确保附件目录存在
        attachments_dir.mkdir(parents=True, exist_ok=True)

        video_id = getattr(task, 'video_id', '') or ''
        img_counter = 0

        def replace_image(match):
            nonlocal img_counter
            full_match = match.group(0)
            alt_text = match.group(1)
            url = match.group(2)

            # 尝试解析为本地文件路径
            local_path = self._resolve_image_url(url, task)
            if not local_path or not local_path.exists():
                # 无法解析的图片保持原样
                return full_match

            img_counter += 1
            # 生成文件名：{video_id}_{序号}.{ext}，无 video_id 时用 img_{序号}
            ext = local_path.suffix or '.jpg'
            if video_id:
                filename = f"{video_id}_{img_counter}{ext}"
            else:
                filename = f"img_{img_counter}{ext}"

            # 复制图片到附件目录
            target_path = attachments_dir / filename
            try:
                shutil.copy2(str(local_path), str(target_path))
            except Exception as e:
                logger.warning(f"复制图片失败: {local_path} -> {target_path}: {e}")
                return full_match

            # 替换为 Obsidian Wikilink 格式
            return f"![[{filename}]]"

        # 匹配 Markdown 图片语法 ![alt](url)
        markdown = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', replace_image, markdown)

        return markdown

    def _process_images_api(self, markdown: str, task_id: str, task,
                            api_url: str, folder_path: str, attachments_folder: str,
                            headers: dict) -> str:
        """API 模式下处理图片：上传到 Vault + 替换为 Wikilink"""
        video_id = getattr(task, 'video_id', '') or ''
        img_counter = 0

        def replace_image(match):
            nonlocal img_counter
            full_match = match.group(0)
            alt_text = match.group(1)
            url = match.group(2)

            # 尝试解析为本地文件路径
            local_path = self._resolve_image_url(url, task)
            if not local_path or not local_path.exists():
                return full_match

            img_counter += 1
            ext = local_path.suffix or '.jpg'
            if video_id:
                filename = f"{video_id}_{img_counter}{ext}"
            else:
                filename = f"img_{img_counter}{ext}"

            # 上传图片到 Obsidian Vault
            attachment_path = f"{folder_path}{attachments_folder}{filename}"
            try:
                with open(local_path, 'rb') as f:
                    upload_headers = {
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/octet-stream"
                    }
                    resp = requests.put(
                        f"{api_url}/vault/{attachment_path}",
                        headers=upload_headers,
                        data=f.read(),
                        timeout=30
                    )
                    if resp.status_code not in (200, 201, 204):
                        logger.warning(f"上传图片失败: {attachment_path}, status={resp.status_code}")
                        return full_match
            except Exception as e:
                logger.warning(f"上传图片异常: {attachment_path}: {e}")
                return full_match

            # 替换为 Obsidian Wikilink 格式
            return f"![[{filename}]]"

        # 匹配 Markdown 图片语法 ![alt](url)
        markdown = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', replace_image, markdown)

        return markdown

    def _resolve_image_url(self, url: str, task) -> Path | None:
        """将 API URL 解析为本地文件路径

        支持的 URL 格式：
        - /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}
        - /api/note_media_file/{platform}/{author_id}/{video_id}/{filename}
        - /api/video_cover/{platform}/{author_id}/{video_id}
        """
        from app.utils.path_helper import VIDEO_DIR, _get_platform_dir

        def _safe_basename(filename: str) -> str | None:
            """净化文件名，防止路径遍历（拒绝 .. 和路径分隔符）"""
            if not filename:
                return None
            # URL 解码
            from urllib.parse import unquote
            filename = unquote(filename)
            # 只取 basename（去掉任何路径分隔符）
            filename = filename.replace('\\', '/').split('/')[-1]
            # 拒绝 . 和 ..
            if filename in ('.', '..') or not filename.strip():
                return None
            return filename

        # 截图: /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}
        m = re.match(r'/api/video_screenshots/([^/]+)/([^/]+)/([^/]+)/(.+)', url)
        if m:
            platform_dir, author_id, video_id, raw_filename = m.groups()
            filename = _safe_basename(raw_filename)
            if not filename:
                return None
            video_folder = self._find_video_folder(author_id, video_id, task)
            if video_folder:
                screenshot_path = video_folder / "screenshots" / filename
                # 安全校验：确保最终路径仍在 video_folder 内
                try:
                    screenshot_path.resolve().relative_to(video_folder.resolve())
                except ValueError:
                    logger.warning(f"路径遍历风险，已拒绝: {url}")
                    return None
                if screenshot_path.exists():
                    return screenshot_path

        # 媒体文件: /api/note_media_file/{platform}/{author_id}/{video_id}/{filename}
        m = re.match(r'/api/note_media_file/([^/]+)/([^/]+)/([^/]+)/(.+)', url)
        if m:
            platform_dir, author_id, video_id, raw_filename = m.groups()
            filename = _safe_basename(raw_filename)
            if not filename:
                return None
            video_folder = self._find_video_folder(author_id, video_id, task)
            if video_folder:
                media_path = video_folder / filename
                try:
                    media_path.resolve().relative_to(video_folder.resolve())
                except ValueError:
                    logger.warning(f"路径遍历风险，已拒绝: {url}")
                    return None
                if media_path.exists():
                    return media_path

        # 封面: /api/video_cover/{platform}/{author_id}/{video_id}
        m = re.match(r'/api/video_cover/([^/]+)/([^/]+)/([^/]+)', url)
        if m:
            platform_dir, author_id, video_id = m.groups()
            video_folder = self._find_video_folder(author_id, video_id, task)
            if video_folder:
                cover_path = video_folder / "cover.jpg"
                if cover_path.exists():
                    return cover_path

        # image_proxy 无法解析为本地文件，跳过
        if '/api/image_proxy' in url:
            return None

        return None

    def _find_video_folder(self, author_id: str, video_id: str, task) -> Path | None:
        """查找视频目录，利用 task 信息和自愈合逻辑"""
        try:
            return get_video_folder(
                author_id=author_id,
                author_name=getattr(task, 'author_name', '') or '',
                video_id=video_id,
                title=getattr(task, 'title', '') or '',
                platform=getattr(task, 'platform', '') or ''
            )
        except Exception:
            return None

    def _adapt_markdown(self, content: str) -> str:
        """适配 Markdown 内容为 Obsidian 格式"""
        # 移除内部锚点链接（同 Siyuan）
        content = re.sub(r'\[([^\]]+)\]\(#([^\)]+)\)', r'\1', content)
        return content


def _safe_filename(title: str) -> str:
    """生成安全的文件名（去除 Obsidian 不允许的字符）"""
    if not title:
        return "untitled"
    # 移除文件系统不允许的字符
    safe = re.sub(r'[\\/*?:"<>|]', '', title).strip()
    # 移除首尾的点号（Windows 不允许）
    safe = safe.strip('.')
    if not safe:
        return "untitled"
    # 限制长度
    if len(safe) > 200:
        safe = safe[:200].rstrip()
    return safe


def _yaml_escape(value: str) -> str:
    """转义 YAML 字符串中的特殊字符"""
    if not value:
        return ""
    # 转义双引号
    return value.replace('\\', '\\\\').replace('"', '\\"')
