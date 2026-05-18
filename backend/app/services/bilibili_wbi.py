"""B站 WBI 签名模块"""
import hashlib
import time
import threading
import requests
from typing import Optional
from datetime import datetime, timedelta

from app.utils.logger import get_logger

logger = get_logger(__name__)

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
            resp = requests.get(
                "https://api.bilibili.com/x/web-interface/nav",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://www.bilibili.com",
                },
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


def sign_wbi_params(params: dict) -> dict:
    """对参数进行 WBI 签名"""
    img_key, sub_key = get_wbi_keys()

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

    # 添加 key 并计算 MD5
    to_sign = query_string + img_key + sub_key
    w_rid = hashlib.md5(to_sign.encode()).hexdigest()

    params["w_rid"] = w_rid

    return params