from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt_handler import decode_token
from app.db.user_dao import get_user_by_id
from jose import JWTError

security = HTTPBearer(auto_error=False)


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
    return user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user
