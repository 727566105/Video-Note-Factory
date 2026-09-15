import requests
from app.db.engine import get_db
from app.utils.logger import get_logger
from app.db.models.obsidian_config import ObsidianConfig
from cryptography.fernet import Fernet
import os

logger = get_logger(__name__)

ENCRYPTION_KEY = os.getenv('WEBDAV_ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    raise RuntimeError("WEBDAV_ENCRYPTION_KEY 环境变量必须设置，请参考 .env.example")
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def get_config():
    """获取 Obsidian 配置"""
    db = next(get_db())
    try:
        config = db.query(ObsidianConfig).order_by(ObsidianConfig.id.desc()).first()
        return config
    except Exception as e:
        logger.error(f"Failed to get obsidian config: {e}")
        return None
    finally:
        db.close()


def upsert_config(
    export_mode: str = "local",
    vault_path: str = None,
    folder_path: str = "videoNote/",
    attachments_folder: str = "attachments/",
    api_url: str = None,
    api_key: str = None,
    enabled: int = 1
):
    """插入或更新 Obsidian 配置（API Key 加密存储）"""
    db = next(get_db())
    try:
        # 加密 API Key
        encrypted_key = None
        if api_key:
            encrypted_key = cipher_suite.encrypt(api_key.encode()).decode()

        config = db.query(ObsidianConfig).order_by(ObsidianConfig.id.desc()).first()
        if config:
            # 更新现有配置
            config.export_mode = export_mode
            config.vault_path = vault_path
            config.folder_path = folder_path
            config.attachments_folder = attachments_folder
            config.api_url = api_url
            if encrypted_key is not None:
                config.api_key = encrypted_key
            config.enabled = enabled
        else:
            # 创建新配置
            config = ObsidianConfig(
                export_mode=export_mode,
                vault_path=vault_path,
                folder_path=folder_path,
                attachments_folder=attachments_folder,
                api_url=api_url,
                api_key=encrypted_key,
                enabled=enabled
            )
            db.add(config)
        db.commit()
        logger.info(f"Obsidian config upsert successfully: {config.id}")
        return config.id
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to upsert obsidian config: {e}")
        raise
    finally:
        db.close()


def get_decrypted_key() -> str | None:
    """获取解密后的 API Key"""
    config = get_config()
    if not config or not config.api_key:
        return None
    try:
        return cipher_suite.decrypt(config.api_key.encode()).decode()
    except Exception as e:
        logger.error(f"Failed to decrypt obsidian api key: {e}")
        return None


def get_decrypted_config():
    """获取解密后的配置对象（用于 ObsidianExporter）"""
    config = get_config()
    if not config:
        return None
    try:
        if config.api_key:
            decrypted_key = cipher_suite.decrypt(config.api_key.encode()).decode()
            config._decrypted_key = decrypted_key
        else:
            config._decrypted_key = None
        return config
    except Exception as e:
        logger.error(f"Failed to decrypt obsidian api key: {e}")
        return None


def test_vault_access(vault_path: str) -> tuple[bool, str]:
    """测试 Vault 目录访问权限"""
    from pathlib import Path

    try:
        vault = Path(vault_path)

        # 检查路径是否存在
        if not vault.exists():
            return False, f"路径不存在: {vault_path}"

        # 检查是否为目录
        if not vault.is_dir():
            return False, f"路径不是目录: {vault_path}"

        # 检查 .obsidian 目录是否存在（验证是否为有效 Vault）
        obsidian_dir = vault / ".obsidian"
        if not obsidian_dir.exists():
            return False, f"未找到 .obsidian 目录，请确认路径是有效的 Obsidian Vault"

        # 检查写入权限
        test_file = vault / ".videonote_write_test"
        try:
            test_file.write_text("test", encoding="utf-8")
            test_file.unlink()
        except PermissionError:
            return False, f"Vault 目录没有写入权限: {vault_path}"
        except Exception as e:
            return False, f"Vault 目录写入测试失败: {str(e)}"

        return True, "Vault 目录访问正常"
    except Exception as e:
        logger.error(f"Test vault access error: {e}")
        return False, f"测试失败: {str(e)}"


def test_api_connection(api_url: str, api_key: str) -> tuple[bool, str]:
    """测试 Obsidian Local REST API 连接"""
    try:
        from app.utils.ssrf import validate_safe_url

        # SSRF 安全校验
        is_safe, err = validate_safe_url(api_url)
        if not is_safe:
            return False, f"Obsidian API 地址不安全: {err}"

        api_url = api_url.rstrip('/')

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        url = f"{api_url}/"

        logger.info(f"Testing Obsidian Local REST API connection: {url}")

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            return True, "Obsidian Local REST API 连接成功"
        elif response.status_code == 401:
            return False, "API Key 无效，请检查认证信息"
        elif response.status_code == 404:
            # 404 也说明服务在运行，只是路径不对
            return True, "Obsidian Local REST API 连接成功"
        else:
            return False, f"API 返回异常状态码: {response.status_code}"
    except requests.exceptions.Timeout:
        logger.error("Obsidian API connection timeout")
        return False, "连接超时，请检查 Obsidian 是否正在运行且 Local REST API 插件已启用"
    except requests.exceptions.ConnectionError:
        logger.error("Obsidian API connection error")
        return False, "无法连接到 Obsidian Local REST API，请确认地址正确且插件已启用"
    except requests.exceptions.RequestException as e:
        logger.error(f"Obsidian API request error: {e}")
        return False, f"网络错误: {str(e)}"
    except Exception as e:
        logger.error(f"Test Obsidian API connection error: {e}")
        return False, f"测试失败: {str(e)}"


def delete_config():
    """删除 Obsidian 配置"""
    db = next(get_db())
    try:
        db.query(ObsidianConfig).delete()
        db.commit()
        logger.info("Obsidian config deleted successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete obsidian config: {e}")
        raise
    finally:
        db.close()


def update_enabled(enabled: int):
    """更新启用状态"""
    db = next(get_db())
    try:
        config = db.query(ObsidianConfig).first()
        if config:
            config.enabled = enabled
            db.commit()
            logger.info(f"Obsidian config enabled updated to: {enabled}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update enabled: {e}")
        raise
    finally:
        db.close()
