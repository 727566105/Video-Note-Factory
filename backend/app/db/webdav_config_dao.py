from sqlalchemy.orm import Session
from app.db.models.webdav_config import WebDAVConfig
from app.db.engine import get_db
from app.utils.logger import get_logger
from cryptography.fernet import Fernet
import os

logger = get_logger(__name__)

# 加载加密密钥
ENCRYPTION_KEY = os.getenv('WEBDAV_ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    # 如果环境变量未设置，生成一个临时密钥（仅用于开发环境）
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    logger.warning("WEBDAV_ENCRYPTION_KEY not set, using temporary key")

cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def get_config() -> WebDAVConfig | None:
    """获取 WebDAV 配置"""
    db = next(get_db())
    try:
        config = db.query(WebDAVConfig).first()
        return config
    finally:
        db.close()


def upsert_config(url: str, username: str, password: str, path: str = '/',
                 auto_backup_enabled: int = 0, auto_backup_schedule: str = '0 2 * * *') -> int:
    """保存或更新 WebDAV 配置"""
    db = next(get_db())
    try:
        config = db.query(WebDAVConfig).first()

        # 加密密码
        encrypted_password = cipher_suite.encrypt(password.encode()).decode()

        if config:
            # 更新现有配置
            config.url = url
            config.username = username
            config.password = encrypted_password
            config.path = path
            config.auto_backup_enabled = auto_backup_enabled
            config.auto_backup_schedule = auto_backup_schedule
            db.commit()
            logger.info(f"Updated WebDAV config: {config.id}")
        else:
            # 创建新配置
            config = WebDAVConfig(
                url=url,
                username=username,
                password=encrypted_password,
                path=path,
                auto_backup_enabled=auto_backup_enabled,
                auto_backup_schedule=auto_backup_schedule
            )
            db.add(config)
            db.commit()
            logger.info(f"Created new WebDAV config: {config.id}")

        return config.id
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to upsert WebDAV config: {e}")
        raise
    finally:
        db.close()


def update_config(config_id: int, **kwargs) -> bool:
    """更新 WebDAV 配置的特定字段"""
    db = next(get_db())
    try:
        config = db.query(WebDAVConfig).filter(WebDAVConfig.id == config_id).first()
        if not config:
            return False

        # 如果更新密码，需要加密
        if 'password' in kwargs:
            kwargs['password'] = cipher_suite.encrypt(kwargs['password'].encode()).decode()

        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)

        db.commit()
        logger.info(f"Updated WebDAV config field: {config_id}")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update WebDAV config: {e}")
        raise
    finally:
        db.close()


def delete_config() -> bool:
    """删除 WebDAV 配置"""
    db = next(get_db())
    try:
        config = db.query(WebDAVConfig).first()
        if config:
            db.delete(config)
            db.commit()
            logger.info("Deleted WebDAV config")
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete WebDAV config: {e}")
        raise
    finally:
        db.close()


def test_connection(url: str, username: str, password: str) -> tuple[bool, str]:
    """测试 WebDAV 连接"""
    try:
        from webdav3.client import Client

        # 确保 URL 格式正确
        url = url.rstrip('/')

        logger.info(f"Testing WebDAV connection: {url}")
        logger.info(f"Using username: {username}")

        # 直接使用完整 URL
        client = Client({
            'webdav_hostname': url,
            'webdav_login': username,
            'webdav_password': password
        })

        # 尝试列出根目录来验证连接（使用空路径表示根目录）
        try:
            root_items = client.list('')
            logger.info(f"WebDAV connection successful, found {len(root_items)} items")
            return True, f"连接成功，服务器可访问"
        except Exception as list_error:
            # 如果列出根目录失败，尝试创建一个测试文件
            try:
                test_path = "bilinote_test"
                client.mkdir(test_path)
                client.rmdir(test_path)
                logger.info("WebDAV connection successful (write test)")
                return True, "连接成功，有写入权限"
            except Exception as write_error:
                return False, f"连接成功但无写入权限: {str(write_error)}"

    except Exception as e:
        logger.error(f"WebDAV connection failed: {e}")
        return False, f"连接失败: {str(e)}"


def update_last_backup_time():
    """更新最后备份时间"""
    db = next(get_db())
    try:
        config = db.query(WebDAVConfig).first()
        if config:
            from datetime import datetime
            config.last_backup_at = datetime.now()
            db.commit()
            logger.info("Updated last backup time")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update last backup time: {e}")
    finally:
        db.close()


def get_decrypted_password() -> str | None:
    """获取解密后的密码（仅用于内存中使用）"""
    config = get_config()
    if not config:
        return None

    try:
        decrypted_password = cipher_suite.decrypt(config.password.encode()).decode()
        return decrypted_password
    except Exception as e:
        logger.error(f"Failed to decrypt password: {e}")
        return None
