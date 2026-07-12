import os
import secrets
import hashlib
import re
from datetime import datetime, timezone
from app.db.models.users import User
from app.db.engine import get_db
from app.utils.logger import get_logger
from passlib.context import CryptContext

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
INSECURE_DEFAULT_ADMIN_PASSWORDS = {"", "123456", "admin", "password", "change_me_on_first_login"}


def is_insecure_default_admin_password(password: str | None) -> bool:
    return (password or "").strip() in INSECURE_DEFAULT_ADMIN_PASSWORDS


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_user(username: str, password: str, role: str = "user") -> User:
    db = next(get_db())
    try:
        existing = db.query(User).filter_by(username=username).first()
        if existing:
            raise ValueError(f"用户名 '{username}' 已存在")
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            password_changed_at=_now_utc(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"用户创建成功: {username}")
        return user
    except Exception as e:
        db.rollback()
        logger.error(f"创建用户失败: {e}")
        raise
    finally:
        db.close()


def get_user_by_username(username: str):
    db = next(get_db())
    try:
        return db.query(User).filter_by(username=username).first()
    finally:
        db.close()


def get_user_by_id(user_id: int):
    db = next(get_db())
    try:
        return db.query(User).filter_by(id=user_id).first()
    finally:
        db.close()


def get_all_users():
    db = next(get_db())
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        return [
            {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    finally:
        db.close()


def update_user(user_id: int, username: str = None, password: str = None, role: str = None):
    db = next(get_db())
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise ValueError("用户不存在")
        if username:
            existing = db.query(User).filter(User.username == username, User.id != user_id).first()
            if existing:
                raise ValueError(f"用户名 '{username}' 已存在")
            user.username = username
        if password:
            user.password_hash = hash_password(password)
            user.password_changed_at = _now_utc()
        if role:
            user.role = role
        db.commit()
        db.refresh(user)
        logger.info(f"用户更新成功: {user.username}")
        return {"id": user.id, "username": user.username, "role": user.role}
    except Exception as e:
        db.rollback()
        logger.error(f"更新用户失败: {e}")
        raise
    finally:
        db.close()


def delete_user(user_id: int):
    db = next(get_db())
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise ValueError("用户不存在")
        if user.username == "admin":
            raise ValueError("不能删除管理员账号")
        db.delete(user)
        db.commit()
        logger.info(f"用户删除成功: {user.username}")
        return {"message": "删除成功"}
    except Exception as e:
        db.rollback()
        logger.error(f"删除用户失败: {e}")
        raise
    finally:
        db.close()


def seed_default_user():
    """种子默认管理员账号"""
    db = next(get_db())
    try:
        existing = db.query(User).filter_by(username="admin").first()
        if existing:
            return

        default_password = os.getenv("DEFAULT_ADMIN_PASSWORD")
        env = os.getenv("ENV", "development").lower()

        if env == "production" and is_insecure_default_admin_password(default_password):
            raise RuntimeError("生产环境必须设置安全的 DEFAULT_ADMIN_PASSWORD，且不能使用默认弱口令")

        if not default_password:
            default_password = "dev_admin_change_me"

        user = User(
            username="admin",
            password_hash=hash_password(default_password),
            role="admin",
            password_changed_at=_now_utc(),
        )
        db.add(user)
        db.commit()
        logger.info("默认管理员账号已创建: admin")
        logger.warning("请立即修改默认管理员密码！")
    except Exception as e:
        db.rollback()
        logger.error(f"种子默认用户失败: {e}")
        raise
    finally:
        db.close()


def generate_api_key(user_id: int) -> str:
    """生成并保存 API Key（格式：vn_ + 32位随机hex），用于 MCP 鉴权。
    数据库存哈希值，明文仅返回一次。"""
    from datetime import datetime
    db = next(get_db())
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise ValueError("用户不存在")
        api_key = f"vn_{secrets.token_hex(16)}"
        user.api_key = api_key  # 保留明文用于前端展示脱敏（仅前8后4）
        user.api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        user.api_key_created_at = datetime.now()
        user.api_key_last_used_at = None
        db.commit()
        logger.info(f"用户 {user.username} 的 API Key 已生成/重置")
        return api_key
    except Exception as e:
        db.rollback()
        logger.error(f"生成 API Key 失败: {e}")
        raise
    finally:
        db.close()


# API Key 格式：vn_ + 32 位 hex（共 35 字符）
_API_KEY_PATTERN = re.compile(r"^vn_[a-f0-9]{32}$")


def get_user_by_api_key(api_key: str):
    """通过 API Key 查用户（MCP 鉴权用）。
    先格式校验，再哈希后按 hash 查询，避免明文比对和注入风险。
    认证成功后异步更新 last_used_at（失败静默忽略，不影响请求）。"""
    if not api_key or not _API_KEY_PATTERN.match(api_key):
        return None
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    db = next(get_db())
    try:
        user = db.query(User).filter_by(api_key_hash=key_hash).first()
        if user:
            # 非阻塞更新最后使用时间（失败不影响鉴权）
            try:
                from datetime import datetime
                user.api_key_last_used_at = datetime.now()
                db.commit()
            except Exception:
                db.rollback()
        return user
    finally:
        db.close()


def clear_api_key(user_id: int) -> bool:
    """清除用户的 API Key"""
    db = next(get_db())
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            return False
        user.api_key = None
        user.api_key_hash = None
        user.api_key_created_at = None
        user.api_key_last_used_at = None
        db.commit()
        logger.info(f"用户 {user.username} 的 API Key 已清除")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"清除 API Key 失败: {e}")
        return False
    finally:
        db.close()


def get_api_key_info(user_id: int) -> dict:
    """获取用户的 API Key 信息（脱敏，不返回明文）"""
    db = next(get_db())
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user or not user.api_key:
            return {"exists": False, "masked": None}
        key = user.api_key
        masked = key[:8] + "*" * (len(key) - 12) + key[-4:] if len(key) > 12 else "****"
        return {
            "exists": True,
            "masked": masked,
            "created_at": user.api_key_created_at.isoformat() if user.api_key_created_at else None,
            "last_used_at": user.api_key_last_used_at.isoformat() if user.api_key_last_used_at else None,
        }
    finally:
        db.close()
