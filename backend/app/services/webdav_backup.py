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

# 笔记输出目录
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"
# 数据库文件
DB_FILE = Path(__file__).parent.parent.parent / "bilinote.db"
# 临时备份目录
BACKUP_TEMP_DIR = Path(__file__).parent.parent.parent / ".backup_temp"

# 全局状态，用于并发控制
_backup_in_progress = False
_restore_in_progress = False
_current_operation = None
_current_progress = 0
_current_message = ""


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
            'webdav_password': password
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
                    test_path = f"{test_base}/bilinote_test" if test_base else "bilinote_test"
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

    def _collect_backup_files(self, progress: BackupProgress = None) -> list[Path]:
        """收集需要备份的文件"""
        files = []

        if progress:
            progress.update(10, "正在收集备份文件...")

        # 收集 note_results 目录
        if NOTE_OUTPUT_DIR.exists():
            for file_path in NOTE_OUTPUT_DIR.rglob("*"):
                if file_path.is_file():
                    files.append(file_path)

        # 添加数据库文件
        if DB_FILE.exists():
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
        zip_filename = f"bilinote_backup_{timestamp}.zip"
        zip_path = BACKUP_TEMP_DIR / zip_filename

        if progress:
            progress.update(40, "正在创建压缩包...")

        # 生成配置文件
        from app.services.config_export import ConfigExporter
        configs_json_path = None
        try:
            configs_json_path = ConfigExporter.save_configs_file()
            logger.info(f"Generated configs file: {configs_json_path}")
        except Exception as e:
            logger.warning(f"Failed to generate configs file: {e}, continuing backup without configs")

        # 创建 ZIP 文件
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            total_files = len(files)
            for i, file_path in enumerate(files):
                # 计算相对路径
                if file_path == DB_FILE:
                    arcname = f"bilinote.db"
                else:
                    try:
                        rel_path = file_path.relative_to(NOTE_OUTPUT_DIR)
                        arcname = f"note_results/{rel_path}"
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
            webdav_backup_path = "bilinote_backups"
        else:
            user_path = self.config.path.lstrip('/')
            # 先确保用户路径目录存在
            try:
                self.client.mkdir(user_path)
            except Exception:
                pass  # 目录可能已存在
            webdav_backup_path = f"{user_path}/bilinote_backups"

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

    def create_backup(self, backup_type: str = "manual", progress_callback: Callable = None) -> dict:
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

            # 3. 上传到 WebDAV
            remote_path = self._upload_to_webdav(zip_path, progress)

            # 4. 获取文件信息
            file_size = zip_path.stat().st_size
            file_count = len(files)

            # 5. 清理临时文件
            zip_path.unlink()

            # 6. 记录备份历史
            add_backup_record(
                type=backup_type,
                status="success",
                file_size=file_size,
                file_count=file_count
            )

            # 更新最后备份时间
            from app.db.webdav_config_dao import update_last_backup_time
            update_last_backup_time()

            if progress:
                progress.update(100, "备份完成")

            result = {
                "success": True,
                "remote_path": remote_path,
                "file_size": file_size,
                "file_count": file_count,
                "message": "备份成功"
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
            backup_path = "bilinote_backups"
        else:
            user_path = self.config.path.lstrip('/')
            backup_path = f"{user_path}/bilinote_backups"

        try:
            items = self.client.list(backup_path)
            backups = []

            for item in items:
                if item.endswith('.zip'):
                    backups.append({
                        "name": item,
                        "path": f"{backup_path}/{item}",
                        "size": 0  # webdavclient3 不直接提供大小信息
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
        global _restore_in_progress, _current_operation, _current_progress, _current_message

        if _restore_in_progress:
            raise Exception("恢复操作正在执行中")

        _restore_in_progress = True
        _current_operation = "restore"
        _current_progress = 0
        _current_message = "开始恢复..."

        progress = BackupProgress()

        # 临时恢复目录
        restore_temp_dir = BACKUP_TEMP_DIR / "restore"
        restore_temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            if not self.client:
                self.client = self._get_webdav_client()

            # 1. 下载备份文件（使用相对路径）
            if self.config.path == '/':
                backup_path = f"bilinote_backups/{backup_name}"
            else:
                user_path = self.config.path.lstrip('/')
                backup_path = f"{user_path}/bilinote_backups/{backup_name}"
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

            # 3. 解压备份
            with zipfile.ZipFile(local_zip_path, 'wb') as zipf:
                zipf.extractall(restore_temp_dir)

            if progress:
                progress.update(60, "正在恢复数据库...")

            # 4. 恢复数据库
            restored_db = restore_temp_dir / "bilinote.db"
            if restored_db.exists():
                # 备份当前数据库
                if DB_FILE.exists():
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    backup_db_path = DB_FILE.parent / f"bilinote_pre_restore_{timestamp}.db"
                    shutil.copy2(DB_FILE, backup_db_path)

                # 替换数据库
                shutil.copy2(restored_db, DB_FILE)

            if progress:
                progress.update(80, "正在恢复笔记文件...")

            # 5. 恢复笔记文件
            restored_notes = restore_temp_dir / "note_results"
            if restored_notes.exists():
                # 清理现有 note_results 目录
                if NOTE_OUTPUT_DIR.exists():
                    shutil.rmtree(NOTE_OUTPUT_DIR)
                NOTE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

                # 复制恢复的文件
                for item in restored_notes.iterdir():
                    dest = NOTE_OUTPUT_DIR / item.name
                    if item.is_dir():
                        shutil.copytree(item, dest)
                    else:
                        shutil.copy2(item, dest)

            if progress:
                progress.update(100, "恢复完成")

            result = {
                "success": True,
                "message": "恢复成功",
                "backup_name": backup_name
            }

            _current_message = "恢复成功"
            _current_progress = 100

            return result

        except Exception as e:
            logger.error(f"Restore failed: {e}")
            _current_message = f"恢复失败: {str(e)}"
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
            backup_path = f"bilinote_backups/{backup_name}"
        else:
            user_path = self.config.path.lstrip('/')
            backup_path = f"{user_path}/bilinote_backups/{backup_name}"

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
        "message": _current_message
    }
