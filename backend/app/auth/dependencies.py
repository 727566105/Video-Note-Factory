from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt_handler import decode_token, decode_payload
from app.db.user_dao import get_user_by_id
from jose import JWTError

security = HTTPBearer(auto_error=False)


def _as_aware_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def ensure_token_not_revoked(token: str, user) -> None:
    payload = decode_payload(token)
    issued_at = payload.get("iat")
    password_changed_at = _as_aware_utc(getattr(user, "password_changed_at", None))
    if password_changed_at:
        password_changed_at = password_changed_at.replace(microsecond=0)
    if not issued_at or not password_changed_at:
        return

    if isinstance(issued_at, (int, float)):
        issued_at_dt = datetime.fromtimestamp(issued_at, tz=timezone.utc)
    elif isinstance(issued_at, str):
        issued_at_dt = datetime.fromisoformat(issued_at.replace("Z", "+00:00"))
    else:
        return

    if issued_at_dt < password_changed_at:
        raise JWTError("token 已因密码修改失效")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="未提供认证凭证")
    try:
        user_id = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="token 无效或已过期")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    try:
        ensure_token_not_revoked(credentials.credentials, user)
    except JWTError:
        raise HTTPException(status_code=401, detail="token 无效或已过期")
    return user


async def get_current_user_flexible(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token: str = Query(default=None),
):
    """支持 Header Bearer 或 query ?token= 的鉴权（用于浏览器原生下载大文件）"""
    raw = credentials.credentials if credentials else token
    if not raw:
        raise HTTPException(status_code=401, detail="未提供认证凭证")
    try:
        user_id = decode_token(raw)
    except JWTError:
        raise HTTPException(status_code=401, detail="token 无效或已过期")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    try:
        ensure_token_not_revoked(raw, user)
    except JWTError:
        raise HTTPException(status_code=401, detail="token 无效或已过期")
    return user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user
