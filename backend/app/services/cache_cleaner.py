"""
缓存清理服务
用于清理过期的缓存文件，避免磁盘空间无限累积
"""
import os
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from dotenv import load_dotenv

load_dotenv()

# 缓存目录配置
NOTE_OUTPUT_DIR = Path(os.getenv("NOTE_OUTPUT_DIR", "note_results"))
# 缓存 TTL 配置（天数）
CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS", "7"))

# 需要清理的缓存文件类型
CACHE_FILE_PATTERNS = [
    "*_audio.json",       # 音频元信息缓存
    "*_transcript.json",  # 转写结果缓存
    "*_markdown.md",      # Markdown 缓存
    "*.status.json",      # 任务状态文件（已完成的）
]

logger = logging.getLogger(__name__)


def get_file_age(file_path: Path) -> float:
    """
    获取文件的年龄（天数）

    :param file_path: 文件路径
    :return: 文件年龄（天数）
    """
    if not file_path.exists():
        return -1

    # 获取文件的最后修改时间
    mtime = file_path.stat().st_mtime
    modified_time = datetime.fromtimestamp(mtime)
    age = datetime.now() - modified_time
    return age.total_seconds() / 86400  # 转换为天数


def is_cache_file_expired(file_path: Path, ttl_days: int = CACHE_TTL_DAYS) -> bool:
    """
    判断缓存文件是否过期

    :param file_path: 文件路径
    :param ttl_days: TTL 天数
    :return: 是否过期
    """
    age = get_file_age(file_path)
    return age > ttl_days


def scan_cache_files(cache_dir: Path = NOTE_OUTPUT_DIR) -> Dict[str, List[Path]]:
    """
    扫描缓存目录中的所有缓存文件

    :param cache_dir: 缓存目录
    :return: 按类型分类的缓存文件字典
    """
    if not cache_dir.exists():
        logger.warning(f"缓存目录不存在: {cache_dir}")
        return {}

    result = {}

    for pattern in CACHE_FILE_PATTERNS:
        files = list(cache_dir.glob(pattern))
        result[pattern] = files

    return result


def clean_expired_cache(
    cache_dir: Path = NOTE_OUTPUT_DIR,
    ttl_days: int = CACHE_TTL_DAYS,
    dry_run: bool = False
) -> Tuple[int, int, List[Dict]]:
    """
    清理过期的缓存文件

    :param cache_dir: 缓存目录
    :param ttl_days: TTL 天数
    :param dry_run: 是否只模拟运行（不实际删除）
    :return: (删除文件数, 节省空间字节, 删除文件详情列表)
    """
    if not cache_dir.exists():
        logger.warning(f"缓存目录不存在: {cache_dir}")
        return 0, 0, []

    deleted_count = 0
    freed_bytes = 0
    deleted_files = []

    # 扫描所有缓存文件
    cache_files = scan_cache_files(cache_dir)

    for pattern, files in cache_files.items():
        for file_path in files:
            if is_cache_file_expired(file_path, ttl_days):
                file_size = file_path.stat().st_size
                file_age = get_file_age(file_path)

                file_info = {
                    "path": str(file_path),
                    "size_bytes": file_size,
                    "age_days": round(file_age, 2),
                    "pattern": pattern
                }

                if not dry_run:
                    try:
                        file_path.unlink()
                        logger.info(f"已删除过期缓存文件: {file_path} (年龄: {file_age:.2f}天)")
                        deleted_count += 1
                        freed_bytes += file_size
                        deleted_files.append(file_info)
                    except Exception as e:
                        logger.error(f"删除文件失败: {file_path} - {e}")
                else:
                    # 模拟运行，只记录不删除
                    deleted_files.append(file_info)
                    deleted_count += 1
                    freed_bytes += file_size

    return deleted_count, freed_bytes, deleted_files


def get_cache_stats(cache_dir: Path = NOTE_OUTPUT_DIR) -> Dict:
    """
    获取缓存统计信息

    :param cache_dir: 缓存目录
    :return: 统计信息字典
    """
    if not cache_dir.exists():
        return {
            "total_files": 0,
            "total_size_bytes": 0,
            "expired_files": 0,
            "expired_size_bytes": 0,
            "ttl_days": CACHE_TTL_DAYS
        }

    cache_files = scan_cache_files(cache_dir)

    total_files = 0
    total_size = 0
    expired_files = 0
    expired_size = 0

    for pattern, files in cache_files.items():
        for file_path in files:
            total_files += 1
            file_size = file_path.stat().st_size
            total_size += file_size

            if is_cache_file_expired(file_path):
                expired_files += 1
                expired_size += file_size

    return {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / 1024 / 1024, 2),
        "expired_files": expired_files,
        "expired_size_bytes": expired_size,
        "expired_size_mb": round(expired_size / 1024 / 1024, 2),
        "ttl_days": CACHE_TTL_DAYS
    }


def cache_cleaner_job():
    """
    定时清理任务入口函数，供 scheduler 调用
    """
    try:
        logger.info("开始执行缓存清理任务")

        # 获取统计信息
        stats_before = get_cache_stats()
        logger.info(f"清理前统计: 总文件 {stats_before['total_files']} 个, "
                   f"总大小 {stats_before['total_size_mb']} MB, "
                   f"过期文件 {stats_before['expired_files']} 个")

        # 执行清理
        deleted_count, freed_bytes, deleted_files = clean_expired_cache()

        # 获取清理后统计
        stats_after = get_cache_stats()

        logger.info(f"缓存清理完成: 删除 {deleted_count} 个文件, "
                   f"释放 {round(freed_bytes / 1024 / 1024, 2)} MB 空间")

        return {
            "success": True,
            "deleted_count": deleted_count,
            "freed_bytes": freed_bytes,
            "freed_mb": round(freed_bytes / 1024 / 1024, 2),
            "stats_before": stats_before,
            "stats_after": stats_after
        }

    except Exception as e:
        logger.error(f"缓存清理任务失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }