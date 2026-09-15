import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY 环境变量必须设置，请参考 .env.example")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7


def create_access_token(data: dict) -> str:
    """签发 access token（24h 有效）"""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, days: int = REFRESH_TOKEN_EXPIRE_DAYS) -> str:
    """
    签发 refresh token（默认 7 天有效）。
    payload 标记 type=refresh，与 access token 隔离。
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=days)
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_payload(token: str) -> dict:
    """
    解析 access token，返回完整 payload。失败抛出 JWTError。
    拒绝 refresh token（防止 refresh token 直接访问 API）。
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("user_id") is None:
        raise JWTError("token 中缺少 user_id")
    # 拒绝 refresh token 直接访问 API
    if payload.get("type") == "refresh":
        raise JWTError("refresh token 不能用于访问 API")
    return payload


def decode_token(token: str) -> int:
    """解析 access token，返回 user_id。失败抛出 JWTError"""
    return decode_payload(token)["user_id"]


def decode_refresh_token(token: str) -> int:
    """
    解析 refresh token，返回 user_id。失败抛出 JWTError。
    只接受 type=refresh 的 token。
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("user_id") is None:
        raise JWTError("refresh token 中缺少 user_id")
    if payload.get("type") != "refresh":
        raise JWTError("非 refresh token 类型")
    return payload["user_id"]
