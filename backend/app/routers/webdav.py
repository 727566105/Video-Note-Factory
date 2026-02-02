"""WebDAV 备份 API 路由"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import Optional

from app.services.webdav_backup import WebDAVBackup, get_backup_status
from app.db.webdav_config_dao import (
    get_config as dao_get_config,
    upsert_config,
    test_connection as dao_test_connection,
    delete_config as dao_delete_config
)
from app.db.backup_history_dao import get_backup_history, get_backup_stats
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class WebDAVConfigRequest(BaseModel):
    """WebDAV 配置请求"""
    url: str
    username: str
    password: str
    path: Optional[str] = "/"
    auto_backup_enabled: Optional[int] = 0
    auto_backup_schedule: Optional[str] = "0 2 * * *"


class TestConnectionRequest(BaseModel):
    """测试连接请求"""
    url: str
    username: str
    password: str


class UpdateScheduleRequest(BaseModel):
    """更新备份计划请求"""
    auto_backup_enabled: int
    auto_backup_schedule: str


# ==================== 配置管理 ====================

@router.get("/config")
def get_config():
    """获取 WebDAV 配置"""
    try:
        config = dao_get_config()
        if not config:
            return R.success(data={
                "configured": False,
                "auto_backup_enabled": False
            })

        # 脱敏密码（只显示前 8 位）
        masked_password = config.password[:8] + "..." if len(config.password) > 8 else config.password

        return R.success(data={
            "configured": True,
            "id": config.id,
            "url": config.url,
            "username": config.username,
            "password": masked_password,
            "path": config.path,
            "auto_backup_enabled": config.auto_backup_enabled == 1,
            "auto_backup_schedule": config.auto_backup_schedule,
            "last_backup_at": config.last_backup_at.isoformat() if config.last_backup_at else None,
            "created_at": config.created_at.isoformat() if config.created_at else None,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        })
    except Exception as e:
        logger.error(f"获取 WebDAV 配置失败: {e}")
        return R.error(msg=f"获取配置失败: {str(e)}")


@router.post("/config")
def save_config(data: WebDAVConfigRequest):
    """保存 WebDAV 配置"""
    try:
        config_id = upsert_config(
            url=data.url,
            username=data.username,
            password=data.password,
            path=data.path,
            auto_backup_enabled=data.auto_backup_enabled,
            auto_backup_schedule=data.auto_backup_schedule
        )
        return R.success(data={"id": config_id}, msg="WebDAV 配置保存成功")
    except Exception as e:
        logger.error(f"保存 WebDAV 配置失败: {e}")
        return R.error(msg=f"保存配置失败: {str(e)}")


@router.put("/config")
def update_config(data: WebDAVConfigRequest):
    """更新 WebDAV 配置"""
    try:
        config_id = upsert_config(
            url=data.url,
            username=data.username,
            password=data.password,
            path=data.path,
            auto_backup_enabled=data.auto_backup_enabled,
            auto_backup_schedule=data.auto_backup_schedule
        )
        return R.success(data={"id": config_id}, msg="WebDAV 配置更新成功")
    except Exception as e:
        logger.error(f"更新 WebDAV 配置失败: {e}")
        return R.error(msg=f"更新配置失败: {str(e)}")


@router.delete("/config")
def delete_config():
    """删除 WebDAV 配置"""
    try:
        success = dao_delete_config()
        if success:
            return R.success(msg="WebDAV 配置已删除")
        return R.error(msg="配置不存在")
    except Exception as e:
        logger.error(f"删除 WebDAV 配置失败: {e}")
        return R.error(msg=f"删除配置失败: {str(e)}")


@router.post("/test")
def test_connection(data: TestConnectionRequest):
    """测试 WebDAV 连接"""
    logger.info(f"收到测试连接请求: url={data.url}, username={data.username}")
    try:
        success, message = dao_test_connection(
            url=data.url,
            username=data.username,
            password=data.password
        )
        logger.info(f"测试连接结果: success={success}, message={message}")
        return R.success(data={"success": success, "message": message})
    except Exception as e:
        logger.error(f"测试连接异常: {e}")
        return R.success(data={"success": False, "message": f"测试连接失败: {str(e)}"})


# ==================== 备份操作 ====================

@router.post("/backup")
def create_backup(background_tasks: BackgroundTasks, backup_type: str = "manual"):
    """手动触发备份"""
    try:
        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        # 检查状态
        status = get_backup_status()
        if status["is_busy"]:
            return R.error(msg=f"备份操作正在执行中: {status['message']}")

        # 创建备份服务
        backup_service = WebDAVBackup(config)

        # 执行备份（同步执行，便于获取结果）
        result = backup_service.create_backup(backup_type=backup_type)
        return R.success(data=result, msg="备份成功")

    except Exception as e:
        logger.error(f"备份失败: {e}")
        return R.error(msg=f"备份失败: {str(e)}")


@router.get("/backup/status")
def get_status():
    """获取备份状态"""
    try:
        status = get_backup_status()
        return R.success(data=status)
    except Exception as e:
        logger.error(f"获取备份状态失败: {e}")
        return R.error(msg=f"获取状态失败: {str(e)}")


@router.get("/backups")
def list_backups():
    """获取备份列表"""
    try:
        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        backup_service = WebDAVBackup(config)
        backups = backup_service.list_backups()
        return R.success(data={"backups": backups, "total": len(backups)})
    except Exception as e:
        logger.error(f"获取备份列表失败: {e}")
        return R.error(msg=f"获取备份列表失败: {str(e)}")


@router.delete("/backups/{backup_name}")
def delete_backup(backup_name: str):
    """删除备份文件"""
    try:
        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        backup_service = WebDAVBackup(config)
        success = backup_service.delete_backup(backup_name)

        if success:
            return R.success(msg="备份已删除")
        return R.error(msg="删除失败")
    except Exception as e:
        logger.error(f"删除备份失败: {e}")
        return R.error(msg=f"删除备份失败: {str(e)}")


# ==================== 恢复操作 ====================

@router.post("/restore/{backup_name}")
def restore_backup(backup_name: str):
    """从备份恢复数据"""
    try:
        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        # 检查状态
        status = get_backup_status()
        if status["is_busy"]:
            return R.error(msg=f"恢复操作正在执行中: {status['message']}")

        backup_service = WebDAVBackup(config)
        result = backup_service.restore_backup(backup_name)
        return R.success(data=result, msg="恢复成功")

    except Exception as e:
        logger.error(f"恢复失败: {e}")
        return R.error(msg=f"恢复失败: {str(e)}")


# ==================== 定时任务 ====================

@router.post("/schedule/enable")
def enable_schedule(data: UpdateScheduleRequest):
    """启用自动备份"""
    try:
        from app.db.webdav_config_dao import update_config

        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        update_config(config.id, auto_backup_enabled=data.auto_backup_enabled)

        # 更新定时任务
        from app.tasks.scheduler import update_scheduled_jobs
        update_scheduled_jobs()

        return R.success(msg="自动备份已启用")
    except Exception as e:
        logger.error(f"启用自动备份失败: {e}")
        return R.error(msg=f"启用自动备份失败: {str(e)}")


@router.put("/schedule")
def update_schedule(data: UpdateScheduleRequest):
    """更新备份计划"""
    try:
        from app.db.webdav_config_dao import update_config

        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        update_config(
            config.id,
            auto_backup_enabled=data.auto_backup_enabled,
            auto_backup_schedule=data.auto_backup_schedule
        )

        # 更新定时任务
        from app.tasks.scheduler import update_scheduled_jobs
        update_scheduled_jobs()

        return R.success(msg="备份计划已更新")
    except Exception as e:
        logger.error(f"更新备份计划失败: {e}")
        return R.error(msg=f"更新备份计划失败: {str(e)}")


@router.delete("/schedule")
def disable_schedule():
    """禁用自动备份"""
    try:
        from app.db.webdav_config_dao import update_config

        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置 WebDAV 连接")

        update_config(config.id, auto_backup_enabled=0)

        # 更新定时任务
        from app.tasks.scheduler import update_scheduled_jobs
        update_scheduled_jobs()

        return R.success(msg="自动备份已禁用")
    except Exception as e:
        logger.error(f"禁用自动备份失败: {e}")
        return R.error(msg=f"禁用自动备份失败: {str(e)}")


@router.get("/schedule")
def get_schedule():
    """获取备份计划"""
    try:
        config = dao_get_config()
        if not config:
            return R.success(data={
                "configured": False,
                "auto_backup_enabled": False
            })

        return R.success(data={
            "configured": True,
            "auto_backup_enabled": config.auto_backup_enabled == 1,
            "auto_backup_schedule": config.auto_backup_schedule,
            "last_backup_at": config.last_backup_at.isoformat() if config.last_backup_at else None
        })
    except Exception as e:
        logger.error(f"获取备份计划失败: {e}")
        return R.error(msg=f"获取备份计划失败: {str(e)}")


# ==================== 备份历史 ====================

@router.get("/history")
def get_history(limit: int = 50):
    """获取备份历史"""
    try:
        histories = get_backup_history(limit)
        history_list = []
        for h in histories:
            history_list.append({
                "id": h.id,
                "type": h.type,
                "status": h.status,
                "file_size": h.file_size,
                "file_count": h.file_count,
                "error_message": h.error_message,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            })
        return R.success(data={"history": history_list, "total": len(history_list)})
    except Exception as e:
        logger.error(f"获取备份历史失败: {e}")
        return R.error(msg=f"获取备份历史失败: {str(e)}")


@router.get("/stats")
def get_stats():
    """获取备份统计"""
    try:
        stats = get_backup_stats()
        return R.success(data=stats)
    except Exception as e:
        logger.error(f"获取备份统计失败: {e}")
        return R.error(msg=f"获取备份统计失败: {str(e)}")
