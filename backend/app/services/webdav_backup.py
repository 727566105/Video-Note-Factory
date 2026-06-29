"""WebDAV 备份服务"""
import os
import zipfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Iterator, Callable

from webdav3.client import Client

from app.db.webdav_config_dao import get_config, get_decrypted_password
from app.db.backup_history_dao import add_backup_record, get_backup_history
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 使用统一的路径管理工具
from app.utils.path_helper import NOTE_OUTPUT_DIR, VIDEO_DIR, DATA_DIR, PROJECT_ROOT

# 数据库路径与 engine.py 完全一致
# 修复：原默认值 video_note.db 与 engine 的 data/video_note.db 不一致，
# 导致 DB_FILE 指向不存在的文件，备份会漏掉整个数据库
from app.db.engine import DATABASE_URL
if DATABASE_URL.startswith("sqlite:///"):
    DB_FILE = Path(DATABASE_URL.replace("sqlite:///", ""))
    DB_FILENAME = DB_FILE.name
else:
    DB_FILE = None
    DB_FILENAME = None
# 临时备份目录
BACKUP_TEMP_DIR = PROJECT_ROOT / ".backup_temp"
# 本地导出 zip 存放目录
LOCAL_BACKUP_DIR = DATA_DIR / "backups"

# 全局状态，用于并发控制
_backup_in_progress = False
_restore_in_progress = False
_current_operation = None
_current_progress = 0
_current_message = ""
# 恢复时被跳过的文件（文件名超长等 OSError），供 /backup/status 透传给前端
_current_skipped_files: list[str] = []


class BackupProgress:
    """备份进度回调"""

    def __init__(self):
        self.progress = 0
        self.message = ""

    def update(self, progress: int, message: str):
        """更新进度"""
        self.progress = progress
        self.message = message
        logger.info(f"Backup progress: {progress}% - {message}")


class WebDAVBackup:
    """WebDAV 备份服务"""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.client = None

    def _get_webdav_client(self) -> Client:
        """获取 WebDAV 客户端"""
        if not self.config:
            raise Exception("WebDAV 配置不存在")

        password = get_decrypted_password()
        if not password:
            raise Exception("无法解密密码")

        # 直接使用完整 URL，不使用 webdav_root
        url = self.config.url.rstrip('/')

        return Client({
            'webdav_hostname': url,
            'webdav_login': self.config.username,
            'webdav_password': password,
            'webdav_timeout': 60
        })

    def test_connection(self) -> tuple[bool, str]:
        """测试连接"""
        global _current_operation, _current_message, _current_progress

        try:
            _current_operation = "test"
            _current_message = "正在测试连接..."
            _current_progress = 0

            client = self._get_webdav_client()

            # 测试列出根目录（相对于 hostname 路径）
            if self.config.path == '/':
                test_base = ""
            else:
                test_base = self.config.path.lstrip('/')

            try:
                list_path = test_base if test_base else "/"
                items = client.list(list_path)
                _current_message = f"连接成功，找到 {len(items)} 个项目"
                _current_progress = 100
                return True, "连接成功，服务器可访问"
            except Exception:
                # 如果列出根目录失败，尝试创建测试目录
                try:
                    test_path = f"{test_base}/videonote_test" if test_base else "videonote_test"
                    client.mkdir(test_path)
                    client.rmdir(test_path)
                    _current_message = "连接成功，有写入权限"
                    _current_progress = 100
                    return True, "连接成功，有写入权限"
                except Exception as e:
                    _current_message = f"连接成功但无写入权限: {str(e)}"
                    return False, f"连接成功但无写入权限: {str(e)}"

        except Exception as e:
            logger.error(f"Test connection failed: {e}")
            _current_message = f"连接失败: {str(e)}"
            return False, f"连接失败: {str(e)}"
        finally:
            _current_operation = None
            _current_message = ""
            _current_progress = 0

    @staticmethod
    def _replace_dir(src: Path, dest: Path):
        """用 src 目录整体替换 dest 目录（清空 dest 后复制 src 内容）"""
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True, exist_ok=True)
        for item in src.iterdir():
            target = dest / item.name
            if item.is_dir():
                shutil.copytree(item, target)
            else:
                shutil.copy2(item, target)

    def _collect_backup_files(self, progress: BackupProgress = None) -> list[Path]:
        """收集需要备份的文件"""
        files = []

        if progress:
            progress.update(10, "正在收集备份文件...")

        # 收集 data/video 目录（笔记正文、封面、截图、音视频）
        if VIDEO_DIR.exists():
            for file_path in VIDEO_DIR.rglob("*"):
                if not file_path.is_file():
                    continue
                # 排除 _pending 临时任务目录
                if "_pending" in file_path.parts:
                    continue
                files.append(file_path)

        # 添加数据库文件
        if DB_FILE and DB_FILE.exists():
            files.append(DB_FILE)

        if progress:
            progress.update(30, f"已收集 {len(files)} 个文件")

        return files

    def _create_zip_archive(self, files: list[Path], progress: BackupProgress = None) -> Path:
        """创建 ZIP 压缩包"""
        # 确保临时目录存在
        BACKUP_TEMP_DIR.mkdir(parents=True, exist_ok=True)

        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"videonote_backup_{timestamp}.zip"
        zip_path = BACKUP_TEMP_DIR / zip_filename

        if progress:
            progress.update(40, "正在创建压缩包...")

        # 生成配置文件（包含完整敏感信息用于备份）
        from app.services.config_export import ConfigExporter
        configs_json_path = None
        try:
            configs_json_path = ConfigExporter.save_configs_file(include_sensitive=True)
            logger.info(f"Generated configs file with sensitive data: {configs_json_path}")
        except Exception as e:
            logger.warning(f"Failed to generate configs file: {e}, continuing backup without configs")

        # 创建 ZIP 文件
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            total_files = len(files)
            for i, file_path in enumerate(files):
                # 计算相对路径
                if file_path == DB_FILE:
                    arcname = DB_FILENAME
                else:
                    try:
                        rel_path = file_path.relative_to(VIDEO_DIR)
                        arcname = f"video/{rel_path}"
                    except ValueError:
                        arcname = file_path.name

                zipf.write(file_path, arcname)

                if progress and i % 10 == 0:
                    pct = 40 + int(30 * i / total_files)
                    progress.update(pct, f"正在压缩: {file_path.name}")

            # 添加配置文件到 ZIP 包
            if configs_json_path and os.path.exists(configs_json_path):
                zipf.write(configs_json_path, "configs.json")
                logger.info("Added configs.json to backup archive")
                # 清理临时配置文件
                os.unlink(configs_json_path)

        if progress:
            progress.update(70, "压缩包创建完成")

        return zip_path

    def _upload_to_webdav(self, zip_path: Path, progress: BackupProgress = None) -> str:
        """上传到 WebDAV 服务器"""
        if not self.client:
            self.client = self._get_webdav_client()

        if progress:
            progress.update(75, "正在上传到 WebDAV...")

        # 确保备份目录存在
        # 当 hostname 包含路径时，config.path 应该相对于 hostname 路径
        # 如果 config.path 是 /，我们使用空字符串（表示 hostname 路径本身）
        # 否则去掉前导斜杠，使其成为相对路径
        if self.config.path == '/':
            webdav_backup_path = "videonote_backups"
        else:
            user_path = self.config.path.lstrip('/')
            # 先确保用户路径目录存在
            try:
                self.client.mkdir(user_path)
            except Exception:
                pass  # 目录可能已存在
            webdav_backup_path = f"{user_path}/videonote_backups"

        try:
            self.client.mkdir(webdav_backup_path)
        except Exception:
            pass  # 目录可能已存在

        # 上传文件
        remote_filename = zip_path.name
        remote_path = f"{webdav_backup_path}/{remote_filename}"

        # upload_sync 需要文件路径而不是文件对象
        self.client.upload_sync(remote_path, str(zip_path))

        if progress:
            progress.update(90, "上传完成")

        return remote_path

    def create_backup(self, backup_type: str = "manual", target: str = "webdav", progress_callback: Callable = None) -> dict:
        """
        创建备份

        Args:
            backup_type: 备份类型 (manual/auto)
            progress_callback: 进度回调函数

        Returns:
            dict: 备份结果
        """
        global _backup_in_progress, _current_operation, _current_progress, _current_message

        if _backup_in_progress:
            raise Exception("备份操作正在执行中")

        _backup_in_progress = True
        _current_operation = "backup"
        _current_progress = 0
        _current_message = "开始备份..."

        progress = BackupProgress()

        try:
            # 1. 收集文件
            files = self._collect_backup_files(progress)
            if not files:
                raise Exception("没有找到需要备份的文件")

            # 2. 创建压缩包
            zip_path = self._create_zip_archive(files, progress)

            # 3. 获取文件信息（在移动/删除前计算）
            file_size = zip_path.stat().st_size
            file_count = len(files)

            # 4. 根据目标处理 zip
            if target == "local":
                # 本地导出：保留到 LOCAL_BACKUP_DIR，不上传
                LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                local_dest = LOCAL_BACKUP_DIR / zip_path.name
                shutil.move(str(zip_path), str(local_dest))
                remote_path = None
            else:
                # WebDAV：上传后清理临时 zip
                remote_path = self._upload_to_webdav(zip_path, progress)
                zip_path.unlink()

            # 5. 记录备份历史
            add_backup_record(
                type=backup_type,
                status="success",
                file_size=file_size,
                file_count=file_count
            )

            # 更新最后备份时间（仅 WebDAV 模式）
            if target == "webdav":
                from app.db.webdav_config_dao import update_last_backup_time
                update_last_backup_time()

            if progress:
                progress.update(100, "导出完成" if target == "local" else "备份完成")

            result = {
                "success": True,
                "remote_path": remote_path,
                "filename": zip_path.name,
                "file_size": file_size,
                "file_count": file_count,
                "message": "导出成功" if target == "local" else "备份成功"
            }

            _current_message = "备份成功"
            _current_progress = 100

            return result

        except Exception as e:
            logger.error(f"Backup failed: {e}")

            # 记录失败历史
            add_backup_record(
                type=backup_type,
                status="failed",
                error_message=str(e)
            )

            _current_message = f"备份失败: {str(e)}"

            raise
        finally:
            _backup_in_progress = False
            _current_operation = None
            # 清理临时目录
            if BACKUP_TEMP_DIR.exists():
                shutil.rmtree(BACKUP_TEMP_DIR, ignore_errors=True)

    def list_backups(self) -> list[dict]:
        """
        列出所有备份

        Returns:
            list[dict]: 备份文件列表
        """
        if not self.client:
            self.client = self._get_webdav_client()

        # 使用相对路径（相对于 hostname 中的路径）
        if self.config.path == '/':
            backup_path = "videonote_backups"
        else:
            user_path = self.config.path.lstrip('/')
            backup_path = f"{user_path}/videonote_backups"

        try:
            items = self.client.list(backup_path)
            backups = []

            for item in items:
                if item.endswith('.zip'):
                    # 获取文件信息（包括大小）
                    file_path = f"{backup_path}/{item}"
                    try:
                        file_info = self.client.info(file_path)
                        # 从文件信息中提取大小（字节）
                        file_size = int(file_info.get('size', 0))
                    except Exception as e:
                        logger.warning(f"Failed to get size for {item}: {e}")
                        file_size = 0
                    
                    backups.append({
                        "name": item,
                        "path": file_path,
                        "size": file_size
                    })

            # 按名称倒序排列（时间戳）
            backups.sort(key=lambda x: x["name"], reverse=True)
            return backups

        except Exception as e:
            logger.error(f"List backups failed: {e}")
            # 如果目录不存在，返回空列表
            if "not found" in str(e).lower():
                return []
            raise

    def restore_backup(self, backup_name: str, progress_callback: Callable = None) -> dict:
        """
        从备份恢复

        Args:
            backup_name: 备份文件名
            progress_callback: 进度回调函数

        Returns:
            dict: 恢复结果
        """
        global _restore_in_progress, _current_operation, _current_progress, _current_message, _current_skipped_files

        if _restore_in_progress:
            raise Exception("恢复操作正在执行中")

        _restore_in_progress = True
        _current_operation = "restore"
        _current_progress = 0
        _current_message = "开始恢复..."
        _current_skipped_files = []

        progress = BackupProgress()

        # 临时恢复目录
        restore_temp_dir = BACKUP_TEMP_DIR / "restore"
        restore_temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            if not self.client:
                self.client = self._get_webdav_client()

            # 1. 下载备份文件（使用相对路径）
            if self.config.path == '/':
                backup_path = f"videonote_backups/{backup_name}"
            else:
                user_path = self.config.path.lstrip('/')
                backup_path = f"{user_path}/videonote_backups/{backup_name}"
            local_zip_path = restore_temp_dir / backup_name

            if progress:
                progress.update(10, "正在下载备份文件...")

            with open(local_zip_path, 'wb') as f:
                self.client.download_sync(backup_path, f)

            if progress:
                progress.update(30, "下载完成，正在验证备份...")

            # 2. 验证备份文件
            if not zipfile.is_zipfile(local_zip_path):
                raise Exception("备份文件已损坏")

            if progress:
                progress.update(40, "正在解压备份文件...")

            # 3. 解压备份（容错：跳过文件名超长等条目）
            skipped = _safe_extract_all(local_zip_path, restore_temp_dir)
            if skipped:
                _current_skipped_files = skipped
                logger.warning(f"恢复时跳过 {len(skipped)} 个文件（文件名过长等）: {skipped}")

            if progress:
                progress.update(60, "正在恢复数据库...")

            # 4. 恢复数据库
            restored_db = restore_temp_dir / DB_FILENAME
            if restored_db.exists() and DB_FILE:
                # 备份当前数据库
                if DB_FILE.exists():
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    backup_db_path = DB_FILE.parent / f"{DB_FILENAME}_pre_restore_{timestamp}"
                    shutil.copy2(DB_FILE, backup_db_path)

                # 替换数据库
                shutil.copy2(restored_db, DB_FILE)

            if progress:
                progress.update(80, "正在恢复笔记文件...")

            # 5. 恢复笔记/媒体文件（video/ 优先，note_results/ 兼容旧包）
            restored_video = restore_temp_dir / "video"
            if restored_video.exists():
                WebDAVBackup._replace_dir(restored_video, VIDEO_DIR)
            else:
                restored_notes = restore_temp_dir / "note_results"
                if restored_notes.exists():
                    if not NOTE_OUTPUT_DIR.exists():
                        NOTE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
                    WebDAVBackup._replace_dir(restored_notes, NOTE_OUTPUT_DIR)

            if progress:
                progress.update(100, "恢复完成")

            skipped_count = len(_current_skipped_files)
            if skipped_count > 0:
                message = f"恢复成功（跳过 {skipped_count} 个文件名超长的文件）"
            else:
                message = "恢复成功"

            result = {
                "success": True,
                "message": message,
                "backup_name": backup_name,
                "skipped_count": skipped_count,
                "skipped_files": _format_skipped_files(_current_skipped_files),
            }

            _current_message = message
            _current_progress = 100

            return result

        except Exception as e:
            logger.error(f"Restore failed: {e}")
            _current_message = f"恢复失败: {str(e)}"
            _current_skipped_files = []
            raise
        finally:
            _restore_in_progress = False
            _current_operation = None
            # 清理临时目录
            if BACKUP_TEMP_DIR.exists():
                shutil.rmtree(BACKUP_TEMP_DIR, ignore_errors=True)

    def delete_backup(self, backup_name: str) -> bool:
        """删除备份文件"""
        if not self.client:
            self.client = self._get_webdav_client()

        # 使用相对路径（相对于 hostname 中的路径）
        if self.config.path == '/':
            backup_path = f"videonote_backups/{backup_name}"
        else:
            user_path = self.config.path.lstrip('/')
            backup_path = f"{user_path}/videonote_backups/{backup_name}"

        try:
            self.client.clean(backup_path)
            logger.info(f"Deleted backup: {backup_name}")
            return True
        except Exception as e:
            logger.error(f"Delete backup failed: {e}")
            raise


def get_backup_status() -> dict:
    """获取当前备份状态"""
    return {
        "is_busy": _backup_in_progress or _restore_in_progress,
        "current_operation": _current_operation,
        "progress": _current_progress,
        "message": _current_message,
        "skipped_files": list(_current_skipped_files),
    }


def _safe_extract_all(zip_path: Path, dest: Path) -> list[str]:
    """逐文件解压 zip，跳过因文件名过长等 OSError 失败的条目。

    Args:
        zip_path: 待解压的 zip 文件路径
        dest: 解压目标目录

    Returns:
        被跳过的条目名列表（供结果展示）

    Raises:
        Exception: 当被跳过的条目是数据库文件时（无库则恢复无意义）
    """
    skipped: list[str] = []
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        for member in zip_ref.infolist():
            try:
                zip_ref.extract(member, dest)
            except OSError as e:
                member_name = member.filename
                logger.warning(f"解压跳过条目（{e}）: {member_name}")
                # 数据库文件失败视为致命错误（无库则恢复无意义）
                if DB_FILENAME and os.path.basename(member_name) == DB_FILENAME:
                    raise Exception(f"数据库文件解压失败，无法继续恢复: {member_name} ({e})")
                skipped.append(member_name)
    return skipped


def _format_skipped_files(skipped: list[str]) -> list[str]:
    """格式化跳过列表用于展示：单条截断到 80 字符，列表上限 20 条。"""
    result = []
    for name in skipped[:20]:
        if len(name) > 80:
            result.append(name[:80] + "…")
        else:
            result.append(name)
    return result


def _set_restore_progress(progress: int, message: str, callback: Callable = None):
    """更新恢复全局进度状态（供 /backup/status 轮询），并转发给可选的 callback"""
    global _current_progress, _current_message
    _current_progress = progress
    _current_message = message
    logger.info(f"Restore progress: {progress}% - {message}")
    if callback:
        callback(progress, message)


def restore_from_local_file(zip_path: Path, progress_callback: Callable = None) -> dict:
    """
    从本地 ZIP 文件恢复数据

    Args:
        zip_path: 备份文件路径
        progress_callback: 进度回调函数

    Returns:
        dict: 恢复结果
    """
    global _restore_in_progress, _current_operation, _current_progress, _current_message, _current_skipped_files

    if _restore_in_progress:
        raise Exception("恢复操作正在执行中")

    _restore_in_progress = True
    _current_operation = "restore"
    _current_progress = 0
    _current_message = "开始恢复..."
    _current_skipped_files = []

    restore_temp_dir = BACKUP_TEMP_DIR / "restore"
    restore_temp_dir.mkdir(parents=True, exist_ok=True)
    pre_restore_backup_dir = None

    try:
        # 1. 验证并解压备份文件
        progress = BackupProgress()

        _set_restore_progress(10, "正在验证备份文件...", progress_callback)

        if not zipfile.is_zipfile(zip_path):
            raise Exception("备份文件已损坏")

        # 解压到临时目录（容错：跳过文件名超长等条目，避免一个失败导致全军覆没）
        _set_restore_progress(20, "正在解压备份文件...", progress_callback)

        skipped = _safe_extract_all(zip_path, restore_temp_dir)
        if skipped:
            _current_skipped_files = skipped
            logger.warning(f"恢复时跳过 {len(skipped)} 个文件（文件名过长等）: {skipped}")

        # 2. 验证备份内容
        extracted_db = restore_temp_dir / DB_FILENAME
        if not extracted_db.exists() or not DB_FILE:
            raise Exception("备份文件中缺少数据库文件或数据库配置不支持恢复")

        # 3. 备份当前数据
        _set_restore_progress(40, "正在备份当前数据...", progress_callback)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pre_restore_backup_dir = BACKUP_TEMP_DIR / f"pre_restore_{timestamp}"
        # 同秒内重复导入时该目录可能已存在（成功后不清理），先清空再建，避免 copytree 冲突
        if pre_restore_backup_dir.exists():
            shutil.rmtree(pre_restore_backup_dir, ignore_errors=True)
        pre_restore_backup_dir.mkdir(parents=True, exist_ok=True)

        # 备份当前数据库
        if DB_FILE and DB_FILE.exists():
            shutil.copy2(DB_FILE, pre_restore_backup_dir / DB_FILENAME)

        # 备份当前媒体目录
        if VIDEO_DIR.exists():
            shutil.copytree(VIDEO_DIR, pre_restore_backup_dir / "video")
        if NOTE_OUTPUT_DIR.exists():
            shutil.copytree(NOTE_OUTPUT_DIR, pre_restore_backup_dir / "note_results")

        # 4. 恢复数据库
        _set_restore_progress(60, "正在恢复数据库...", progress_callback)

        # 释放连接池，确保 SQLite 文件可被替换
        # （SessionLocal 是 sessionmaker，无 remove()；用 engine.dispose() 释放池连接）
        from app.db.engine import engine
        engine.dispose()

        # 替换数据库文件
        shutil.copy2(extracted_db, DB_FILE)

        # 5. 恢复笔记文件
        _set_restore_progress(80, "正在恢复笔记文件...", progress_callback)

        # 恢复媒体文件（video/ 优先，note_results/ 兼容旧包）
        extracted_video = restore_temp_dir / "video"
        if extracted_video.exists():
            WebDAVBackup._replace_dir(extracted_video, VIDEO_DIR)
        else:
            extracted_notes = restore_temp_dir / "note_results"
            if extracted_notes.exists():
                if not NOTE_OUTPUT_DIR.exists():
                    NOTE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
                WebDAVBackup._replace_dir(extracted_notes, NOTE_OUTPUT_DIR)

        # 6. 恢复配置文件（如果存在）
        _set_restore_progress(90, "正在恢复配置...", progress_callback)

        extracted_config = restore_temp_dir / "configs.json"
        if extracted_config.exists():
            _restore_configs_from_backup(extracted_config)

        _set_restore_progress(100, "恢复完成", progress_callback)

        skipped_count = len(_current_skipped_files)
        if skipped_count > 0:
            message = f"数据恢复成功（跳过 {skipped_count} 个文件名超长的文件）"
        else:
            message = "数据恢复成功"

        _current_message = message
        _current_progress = 100

        return {
            "success": True,
            "pre_restore_backup": str(pre_restore_backup_dir),
            "message": message,
            "skipped_count": skipped_count,
            "skipped_files": _format_skipped_files(_current_skipped_files),
        }

    except Exception as e:
        logger.error(f"从本地文件恢复失败: {e}")
        _current_message = f"恢复失败: {str(e)}"
        _current_skipped_files = []
        # 恢复失败时回滚
        if pre_restore_backup_dir and pre_restore_backup_dir.exists():
            _rollback_restore(pre_restore_backup_dir)
        raise
    finally:
        _restore_in_progress = False
        _current_operation = None
        # 清理临时目录
        if restore_temp_dir.exists():
            shutil.rmtree(restore_temp_dir, ignore_errors=True)


def _restore_configs_from_backup(config_path: Path):
    """从备份中恢复配置"""
    import json
    from app.services.config_export import ConfigImporter

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)

        # 验证配置文件
        is_valid, errors = ConfigImporter.validate_config_file(config_data)
        if not is_valid:
            logger.warning(f"备份中的配置文件无效: {errors}")
            return

        # 获取配置项
        configs = config_data.get("configs", {})

        # 恢复 WebDAV 配置
        webdav_config = configs.get("webdav_config")
        if webdav_config:
            password = webdav_config.get("password", "")
            # 只有当密码不是占位符时才恢复
            if password and password != "********":
                from app.db.webdav_config_dao import upsert_config
                upsert_config(
                    url=webdav_config.get("url", ""),
                    username=webdav_config.get("username", ""),
                    password=password,
                    path=webdav_config.get("path", "/"),
                    auto_backup_enabled=webdav_config.get("auto_backup_enabled", 0),
                    auto_backup_schedule=webdav_config.get("auto_backup_schedule", "0 2 * * *")
                )
                logger.info("从备份中恢复了 WebDAV 配置（包含密码）")
            else:
                logger.warning("WebDAV 密码为占位符，跳过恢复")

        # 恢复思源笔记配置
        siyuan_config = configs.get("siyuan_config")
        if siyuan_config:
            api_token = siyuan_config.get("api_token", "")
            # 只有当 Token 不是占位符时才恢复
            if api_token and api_token != "********":
                from app.db.siyuan_config_dao import upsert_config as siyuan_upsert
                siyuan_upsert(
                    api_url=siyuan_config.get("api_url", ""),
                    api_token=api_token,
                    default_notebook=siyuan_config.get("default_notebook")
                )
                logger.info("从备份中恢复了思源笔记配置（包含 Token）")
            else:
                logger.warning("思源笔记 Token 为占位符，跳过恢复")

        # 恢复 AI 模型配置
        providers = configs.get("providers", [])
        if providers:
            from app.db.provider_dao import get_provider_by_id, insert_provider, update_provider
            restored_count = 0
            for provider_data in providers:
                provider_id = provider_data.get("id")
                api_key = provider_data.get("api_key", "")
                
                # 只有当 API Key 不是占位符时才恢复
                if not provider_id or not api_key or api_key == "********":
                    logger.warning(f"Provider {provider_id} API Key 为占位符，跳过恢复")
                    continue
                
                try:
                    # 检查是否已存在
                    existing = None
                    try:
                        existing = get_provider_by_id(provider_id)
                    except Exception:
                        pass

                    if existing:
                        # 更新现有配置
                        update_provider(
                            provider_id,
                            name=provider_data.get("name"),
                            api_key=api_key,
                            base_url=provider_data.get("base_url"),
                            logo=provider_data.get("logo"),
                            type_=provider_data.get("type"),
                            enabled=provider_data.get("enabled", 1)
                        )
                    else:
                        # 创建新配置
                        insert_provider(
                            id=provider_id,
                            name=provider_data.get("name"),
                            api_key=api_key,
                            base_url=provider_data.get("base_url"),
                            logo=provider_data.get("logo"),
                            type_=provider_data.get("type"),
                            enabled=provider_data.get("enabled", 1)
                        )
                    restored_count += 1
                except Exception as e:
                    logger.error(f"Failed to restore provider {provider_id}: {e}")
            
            if restored_count > 0:
                logger.info(f"从备份中恢复了 {restored_count} 个 AI 模型配置（包含 API Key）")

    except Exception as e:
        logger.error(f"恢复配置失败: {e}")


def _rollback_restore(backup_dir: Path):
    """恢复失败时回滚"""
    try:
        if not backup_dir.exists():
            return

        # 恢复数据库
        backup_db = backup_dir / DB_FILENAME
        if backup_db.exists() and DB_FILE:
            # 释放连接池，确保 SQLite 文件可被替换
            from app.db.engine import engine
            engine.dispose()
            shutil.copy2(backup_db, DB_FILE)

        # 恢复媒体目录（video 优先，note_results 兼容旧包）
        backup_video = backup_dir / "video"
        if backup_video.exists():
            WebDAVBackup._replace_dir(backup_video, VIDEO_DIR)
        backup_notes = backup_dir / "note_results"
        if backup_notes.exists():
            if not NOTE_OUTPUT_DIR.exists():
                NOTE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            WebDAVBackup._replace_dir(backup_notes, NOTE_OUTPUT_DIR)

        logger.info(f"已回滚到恢复前状态: {backup_dir}")

    except Exception as e:
        logger.error(f"回滚失败: {e}")
