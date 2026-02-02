import requests
from app.db.engine import get_db
from app.utils.logger import get_logger
from app.db.models.siyuan_config import SiyuanConfig

logger = get_logger(__name__)


def get_config():
    """获取思源笔记配置"""
    db = next(get_db())
    try:
        config = db.query(SiyuanConfig).order_by(SiyuanConfig.id.desc()).first()
        return config
    except Exception as e:
        logger.error(f"Failed to get siyuan config: {e}")
        return None
    finally:
        db.close()


def upsert_config(api_url: str, api_token: str, default_notebook: str = None):
    """插入或更新思源笔记配置"""
    db = next(get_db())
    try:
        config = db.query(SiyuanConfig).order_by(SiyuanConfig.id.desc()).first()
        if config:
            # 更新现有配置
            config.api_url = api_url
            config.api_token = api_token
            config.default_notebook = default_notebook
            config.enabled = 1
        else:
            # 创建新配置
            config = SiyuanConfig(
                api_url=api_url,
                api_token=api_token,
                default_notebook=default_notebook,
                enabled=1
            )
            db.add(config)
        db.commit()
        logger.info(f"Siyuan config upsert successfully: {config.id}")
        return config.id
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to upsert siyuan config: {e}")
        raise
    finally:
        db.close()


def test_connection(api_url: str, api_token: str) -> tuple[bool, str]:
    """测试思源笔记连接"""
    try:
        # 确保 API URL 格式正确
        api_url = api_url.rstrip('/')
        
        # 调用官方 API 测试连接
        headers = {
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json"
        }
        url = f"{api_url}/api/notebook/lsNotebooks"
        
        logger.info(f"Testing Siyuan connection: {url}")
        logger.info(f"Using token: {api_token[:8]}...")
        
        response = requests.post(url, headers=headers, json={}, timeout=10)
        
        logger.info(f"Response status: {response.status_code}")
        logger.info(f"Response headers: {dict(response.headers)}")
        logger.info(f"Response body: {response.text[:500]}")  # 记录前500字符
        
        # 检查响应是否为空
        if not response.text or response.text.strip() == "":
            logger.error("Empty response from Siyuan API")
            return False, "思源笔记返回空响应，请检查 API Token 是否正确"
        
        result = response.json()

        if result.get("code") == 0:
            notebook_count = len(result.get("data", {}).get("notebooks", []))
            return True, f"连接成功，找到 {notebook_count} 个笔记本"
        else:
            error_msg = result.get("msg", "未知错误")
            logger.error(f"Siyuan API error: {error_msg}")
            return False, f"API 错误: {error_msg}"
    except requests.exceptions.Timeout:
        logger.error("Connection timeout")
        return False, "连接超时，请检查思源笔记是否正在运行"
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error: {e}")
        return False, f"无法连接到思源笔记，请确认地址正确且服务正在运行"
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {e}")
        return False, f"网络错误: {str(e)}"
    except ValueError as e:
        logger.error(f"JSON parse error: {e}, response: {response.text[:200]}")
        return False, "响应格式错误，可能是 API Token 不正确或 API 地址错误"
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return False, f"测试失败: {str(e)}"


def delete_config():
    """删除思源笔记配置"""
    db = next(get_db())
    try:
        db.query(SiyuanConfig).delete()
        db.commit()
        logger.info("Siyuan config deleted successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete siyuan config: {e}")
        raise
    finally:
        db.close()


def update_enabled(enabled: int):
    """更新启用状态"""
    db = next(get_db())
    try:
        config = db.query(SiyuanConfig).first()
        if config:
            config.enabled = enabled
            db.commit()
            logger.info(f"Siyuan config enabled updated to: {enabled}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update enabled: {e}")
        raise
    finally:
        db.close()
