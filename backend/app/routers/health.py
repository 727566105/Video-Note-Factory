from fastapi import APIRouter
from sqlalchemy import text

from app.utils.response import ResponseWrapper as R
from app.db.engine import get_db
from app.db.provider_dao import get_enabled_providers
from app.services.cookie_manager import CookieConfigManager
from app.utils.path_helper import PROJECT_ROOT

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """系统配置健康检查"""
    checks = {}

    # 1. Database
    checks["database"] = _check_database()

    # 2. FFmpeg
    checks["ffmpeg"] = _check_ffmpeg()

    # 3. AI Provider
    checks["ai_provider"] = _check_ai_provider()

    # 4. Cookie
    checks["cookie"] = _check_cookie()

    # 5. Transcriber
    checks["transcriber"] = _check_transcriber()

    # 6. Directories
    checks["directories"] = _check_directories()

    # 计算整体状态
    status = _compute_status(checks)

    return R.success(data={"status": status, "checks": checks})


def _check_database() -> dict:
    """检查数据库连接"""
    db = None
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "message": str(e)}
    finally:
        if db:
            db.close()


def _check_ffmpeg() -> dict:
    """检查 FFmpeg"""
    from ffmpeg_helper import check_ffmpeg_exists
    ok = check_ffmpeg_exists()
    if ok:
        return {"ok": True}
    return {"ok": False, "message": "FFmpeg 未安装，请安装后重启服务"}


def _check_ai_provider() -> dict:
    """检查 AI 模型供应商"""
    try:
        providers = get_enabled_providers()
        has_key = any(p.api_key for p in providers if p.api_key)
        if has_key:
            return {"ok": True, "count": len(providers)}
        return {
            "ok": False,
            "message": "未配置 AI 模型供应商，请前往设置页面添加 API Key",
            "link": "/settings/model"
        }
    except Exception as e:
        return {"ok": False, "message": f"检查失败: {str(e)}"}


def _check_cookie() -> dict:
    """检查平台 Cookie"""
    try:
        cookie_mgr = CookieConfigManager()
        all_cookies = cookie_mgr.list_all()
        platforms = {
            "bilibili": cookie_mgr.exists("bilibili"),
            "douyin": cookie_mgr.exists("douyin"),
        }
        ok = any(platforms.values())
        if ok:
            return {"ok": True, "platforms": platforms}
        return {
            "ok": False,
            "message": "未配置平台 Cookie，部分视频可能无法下载",
            "platforms": platforms,
            "link": "/settings/download"
        }
    except Exception as e:
        return {"ok": False, "message": f"检查失败: {str(e)}"}


def _check_transcriber() -> dict:
    """检查转写器"""
    try:
        from app.transcriber.transcriber_provider import is_transcriber_ready, get_warm_up_status
        ready = is_transcriber_ready()
        status_info = get_warm_up_status()
        transcriber_type = status_info.get("transcriber_type", "unknown")

        if ready:
            return {"ok": True, "type": transcriber_type}
        if status_info.get("in_progress"):
            return {"ok": True, "type": transcriber_type, "message": "模型下载中..."}
        return {"ok": False, "message": "转写模型未就绪", "type": transcriber_type}
    except Exception as e:
        return {"ok": False, "message": f"检查失败: {str(e)}"}


def _check_directories() -> dict:
    """检查关键目录"""
    try:
        dirs = [
            PROJECT_ROOT / "data",
            PROJECT_ROOT / "backend" / "static" / "screenshots",
            PROJECT_ROOT / "config",
        ]
        missing = []
        for d in dirs:
            if not d.exists():
                try:
                    d.mkdir(parents=True, exist_ok=True)
                except Exception:
                    missing.append(str(d))

        if missing:
            return {"ok": False, "message": f"无法创建目录: {', '.join(missing)}"}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "message": f"检查失败: {str(e)}"}


def _compute_status(checks: dict) -> str:
    """计算整体状态"""
    # AI Provider 是核心功能，缺失则为 error
    if not checks.get("ai_provider", {}).get("ok"):
        return "error"
    # Database 是基础，缺失也为 error
    if not checks.get("database", {}).get("ok"):
        return "error"
    # 其他非核心缺失为 degraded
    for key, val in checks.items():
        if key in ("ai_provider", "database"):
            continue
        if not val.get("ok"):
            return "degraded"
    return "ok"