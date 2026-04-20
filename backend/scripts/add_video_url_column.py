#!/usr/bin/env python3
"""
数据库迁移脚本：为 video_tasks 表添加 video_url 字段

使用方法：
    python backend/scripts/add_video_url_column.py
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.engine import get_db

def add_video_url_column():
    """为 video_tasks 表添加 video_url 列"""
    db = next(get_db())
    try:
        # 检查列是否已存在
        result = db.execute(text("PRAGMA table_info(video_tasks)"))
        columns = [row[1] for row in result.fetchall()]

        if 'video_url' in columns:
            print("video_url 列已存在，跳过迁移")
            return

        # 添加新列
        db.execute(text("ALTER TABLE video_tasks ADD COLUMN video_url VARCHAR DEFAULT NULL"))
        db.commit()
        print("成功添加 video_url 列")
    except Exception as e:
        db.rollback()
        print(f"迁移失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_video_url_column()