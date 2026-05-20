"""订阅刷新进度管理"""
import threading
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

# 进度存储（内存 dict）
_progress_store: Dict[str, Dict[str, Any]] = {}
_progress_lock = threading.Lock()


def create_progress(subscription_id: int) -> str:
    """创建进度记录，返回 progress_id"""
    progress_id = str(uuid.uuid4())
    with _progress_lock:
        _progress_store[progress_id] = {
            "progress_id": progress_id,
            "subscription_id": subscription_id,
            "status": "running",
            "current_page": 0,
            "total_pages": 0,
            "fetched_count": 0,
            "added_count": 0,
            "total_count": 0,
            "error": None,
            "created_at": datetime.now().isoformat(),
        }
    return progress_id


def get_progress(progress_id: str) -> Optional[Dict[str, Any]]:
    """获取进度信息"""
    with _progress_lock:
        return _progress_store.get(progress_id)


def update_progress(progress_id: str, **kwargs):
    """更新进度信息"""
    with _progress_lock:
        if progress_id in _progress_store:
            _progress_store[progress_id].update(kwargs)


def complete_progress(progress_id: str, added_count: int, total_count: int, error: Optional[str] = None):
    """标记进度完成"""
    with _progress_lock:
        if progress_id in _progress_store:
            p = _progress_store[progress_id]
            p["status"] = "failed" if error else "completed"
            p["added_count"] = added_count
            p["total_count"] = total_count
            p["error"] = error


def delete_progress(progress_id: str):
    """删除进度记录（完成后可清理）"""
    with _progress_lock:
        _progress_store.pop(progress_id, None)