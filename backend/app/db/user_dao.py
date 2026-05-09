from app.db.models.users import User
from app.db.engine import get_db
from app.utils.logger import get_logger
from passlib.context import CryptContext

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
        if not existing:
            user = User(
                username="admin",
                password_hash=hash_password("123456"),
                role="admin",
            )
            db.add(user)
            db.commit()
            logger.info("默认管理员账号已创建: admin/123456")
    except Exception as e:
        db.rollback()
        logger.error(f"种子默认用户失败: {e}")
    finally:
        db.close()
