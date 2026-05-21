#!/usr/bin/env python3
"""
文件存储迁移脚本
将旧路径 data/notes/{task_id}_{title}/ + data/media/ 迁移到
新路径 data/{author_id}_{author_name}/{video_id}_{title}/

使用方法: cd backend && python3 tools/migrate_storage.py [--dry-run]
"""
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.engine import get_db
from app.db.models.video_tasks import VideoTask
from app.utils.path_helper import (
    DATA_DIR,
    NOTE_OUTPUT_DIR,
    MEDIA_DIR,
    sanitize_path_name,
    get_author_folder_name,
    get_video_folder_name,
)


def extract_author_info(raw_info: dict, platform: str) -> tuple:
    """从 raw_info 提取 author_id 和 author_name"""
    if not raw_info:
        return None, None

    owner = raw_info.get("owner", {})

    # author_id
    author_id = None
    if owner:
        author_id = str(owner.get("mid", "")) or str(owner.get("uid", ""))
    if not author_id:
        author_id = raw_info.get("channel_id") or raw_info.get("uploader_id")
    if not author_id:
        author = raw_info.get("author", {})
        if isinstance(author, dict):
            author_id = str(author.get("uid", "")) or str(author.get("id", ""))

    # author_name
    author_name = None
    if owner:
        author_name = owner.get("name")
    if not author_name:
        author_name = raw_info.get("uploader") or raw_info.get("channel")
    if not author_name and isinstance(raw_info.get("author"), dict):
        author_name = raw_info["author"].get("nickname") or raw_info["author"].get("name")

    # 清理空字符串
    if author_id == "":
        author_id = None
    if author_name == "":
        author_name = None

    return author_id, author_name


def migrate(dry_run: bool = False):
    """执行迁移"""
    db = next(get_db())
    tasks = db.query(VideoTask).all()
    db.close()

    print(f"\n{'[DRY-RUN] ' if dry_run else ''}开始迁移 {len(tasks)} 条任务记录...")
    stats = {"migrated": 0, "skipped": 0, "errors": []}

    # 备份（非 dry-run 时）
    if not dry_run:
        backup_name = f"data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_path = DATA_DIR.parent / backup_name
        print(f"备份数据目录到 {backup_path}...")
        shutil.copytree(DATA_DIR, backup_path, dirs_exist_ok=True)
        print("备份完成")

    for task in tasks:
        try:
            # 读取 raw_info
            note_path = None
            if task.title:
                note_path = NOTE_OUTPUT_DIR / f"{task.task_id[:8]}_{task.title}" / "note.json"
            if not note_path or not note_path.exists():
                note_path = NOTE_OUTPUT_DIR / task.task_id / "note.json"

            raw_info = {}
            if note_path.exists():
                with open(note_path, "r", encoding="utf-8") as f:
                    note_data = json.load(f)
                raw_info = note_data.get("audio_meta", {}).get("raw_info", {}) or {}

            # 提取 author 信息
            author_id, author_name = extract_author_info(raw_info, task.platform)

            # 使用数据库中已有的 author 字段作为 author_name 的补充
            if not author_name and task.author:
                author_name = task.author

            # 更新数据库
            if not dry_run:
                task_db = next(get_db())
                try:
                    t = task_db.query(VideoTask).filter_by(task_id=task.task_id).first()
                    if t:
                        if author_id:
                            t.author_id = author_id
                        if author_name:
                            t.author_name = author_name
                        task_db.commit()
                finally:
                    task_db.close()

            # 构建目标路径
            folder_author = get_author_folder_name(author_id, author_name, task.platform)
            folder_video = get_video_folder_name(task.video_id, task.title or "untitled")
            target_dir = DATA_DIR / folder_author / folder_video

            # 查找源文件
            source_dir = None
            candidates = []
            if task.title:
                candidates.append(NOTE_OUTPUT_DIR / f"{task.task_id[:8]}_{task.title}")
            candidates.append(NOTE_OUTPUT_DIR / task.task_id)

            for candidate in candidates:
                if candidate.exists():
                    source_dir = candidate
                    break

            if not source_dir:
                stats["skipped"] += 1
                continue

            # 迁移文件
            if not dry_run:
                os.makedirs(target_dir, exist_ok=True)
                for item in source_dir.iterdir():
                    if item.is_file():
                        shutil.copy2(item, target_dir / item.name)

                # 迁移媒体文件
                for media_type in ["audio", "video"]:
                    for ext in ["mp3", "mp4", "mkv", "webm", "m4a"]:
                        media_src = MEDIA_DIR / media_type / f"{task.task_id}.{ext}"
                        if not media_src.exists():
                            media_src = MEDIA_DIR / media_type / f"{task.video_id}.{ext}"
                        if media_src.exists():
                            shutil.copy2(media_src, target_dir / media_src.name)

            stats["migrated"] += 1
            print(f"  ✓ {task.task_id[:8]} → {folder_author}/{folder_video}")

        except Exception as e:
            stats["errors"].append(f"{task.task_id}: {e}")
            print(f"  ✗ {task.task_id}: {e}")

    # 报告
    print(f"\n{'='*50}")
    print(f"迁移完成: {stats['migrated']} 成功, {stats['skipped']} 跳过, {len(stats['errors'])} 错误")
    if dry_run:
        print("(DRY-RUN 模式，未实际修改文件)")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    migrate(dry_run=dry_run)