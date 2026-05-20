"""B站 WBI 签名模块"""
import hashlib
import time
import threading
import requests
from typing import Optional
from datetime import datetime, timedelta

from app.utils.logger import get_logger

logger = get_logger(__name__)

# WBI mixin key 置换表（B站固定值）
_MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]

# WBI key 缓存（有效期 20 分钟）
_wbi_keys_cache: Optional[tuple[str, str, datetime]] = None
_wbi_cache_lock = threading.Lock()


def get_wbi_keys() -> tuple[str, str]:
    """获取 WBI 签名所需的 img_key 和 sub_key"""
    global _wbi_keys_cache

    # 快速检查（无锁）
    if _wbi_keys_cache:
        img_key, sub_key, expire_time = _wbi_keys_cache
        if datetime.now() < expire_time:
            return img_key, sub_key

    # 加锁获取
    with _wbi_cache_lock:
        # 双重检查
        if _wbi_keys_cache:
            img_key, sub_key, expire_time = _wbi_keys_cache
            if datetime.now() < expire_time:
                return img_key, sub_key

        # 从B站获取最新 key
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.bilibili.com",
            }
            # 尝试携带 Cookie（解决"账号未登录"问题）
            try:
                from app.services.cookie_manager import CookieConfigManager
                cfm = CookieConfigManager()
                cookie_str = cfm.get("bilibili")
                if cookie_str:
                    headers["Cookie"] = cookie_str
            except Exception:
                pass

            resp = requests.get(
                "https://api.bilibili.com/x/web-interface/nav",
                headers=headers,
                timeout=10,
            )
            data = resp.json()
            if data.get("code") != 0:
                raise Exception(f"B站 API 返回错误: {data.get('message')}")

            wbi_img = data.get("data", {}).get("wbi_img", {})
            img_url = wbi_img.get("img_url", "")
            sub_url = wbi_img.get("sub_url", "")

            img_key = extract_key_from_url(img_url)
            sub_key = extract_key_from_url(sub_url)

            if not img_key or not sub_key:
                raise Exception("无法从 URL 提取 WBI key")

            _wbi_keys_cache = (img_key, sub_key, datetime.now() + timedelta(minutes=20))
            logger.info(f"WBI keys 已更新: img_key={img_key[:8]}..., sub_key={sub_key[:8]}...")

            return img_key, sub_key
        except Exception as e:
            logger.error(f"获取 WBI keys 失败: {e}")
            raise


def extract_key_from_url(url: str) -> str:
    """从 URL 中提取 WBI key"""
    # URL 格式: //i0.hdslb.com/bfs/wbi/6592e8c3a2c62f7b14a5a9d9e5a5a5a5.png
    if not url:
        return ""
    # 取最后一个 / 后面的部分，去掉 .png
    parts = url.split("/")
    if len(parts) < 2:
        return ""
    filename = parts[-1]
    key = filename.replace(".png", "")
    return key


def _get_mixin_key(img_key: str, sub_key: str) -> str:
    """通过置换表计算 mixin_key"""
    combined = img_key + sub_key
    return "".join(combined[i] for i in _MIXIN_KEY_ENC_TAB)[:32]


def sign_wbi_params(params: dict) -> dict:
    """对参数进行 WBI 签名（返回新字典，不修改入参）"""
    params = dict(params)
    img_key, sub_key = get_wbi_keys()
    mixin_key = _get_mixin_key(img_key, sub_key)

    # 添加时间戳
    params["wts"] = int(time.time())

    # 按 key 字典序排序
    sorted_keys = sorted(params.keys())

    # 拼接参数
    query_parts = []
    for key in sorted_keys:
        value = params[key]
        # 特殊字符替换
        if isinstance(value, str):
            value = value.replace("!", "").replace("'", "").replace("(", "").replace(")", "")
        query_parts.append(f"{key}={value}")

    query_string = "&".join(query_parts)

    # 使用 mixin_key 计算 MD5
    w_rid = hashlib.md5((query_string + mixin_key).encode()).hexdigest()

    params["w_rid"] = w_rid

    return params