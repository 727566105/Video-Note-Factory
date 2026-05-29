"""抖音用户视频列表分页获取 — 原生 API"""
import os
import json
import time
from typing import Optional, Callable
from datetime import datetime
from urllib.parse import urlencode, quote

import requests

from app.downloaders.douyin_helper.abogus import ABogus
from app.downloaders.douyin_downloader import DouyinConfig, BaseRequestModel, get_timestamp
from app.utils.logger import get_logger

logger = get_logger(__name__)

DOUYIN_API_URL = "https://www.douyin.com/aweme/v1/web/aweme/post/"
DOUYIN_PAGE_INTERVAL = int(os.getenv("DOUYIN_PAGE_INTERVAL", "5"))


class DouyinFetchResult:
    """抖音获取结果"""
    def __init__(self, items=None, error=None, next_cursor=0, has_more=False):
        self.items = items or []
        self.error = error
        self.next_cursor = next_cursor
        self.has_more = has_more
        self.success = error is None


def _get_cookie_manager():
    from app.services.cookie_manager import CookieConfigManager
    return CookieConfigManager()


def _build_douyin_params(sec_uid: str, max_cursor: int = 0, count: int = 20) -> dict:
    """构建抖音 API 参数"""
    base = BaseRequestModel().model_dump()
    base.update({
        "sec_user_id": sec_uid,
        "max_cursor": max_cursor,
        "count": count,
    })
    return base


def _sign_douyin_params(params: dict) -> str:
    """生成 a_bogus 签名"""
    bogus = ABogus()
    a_bogus = bogus.get_value(params)
    return quote(a_bogus, safe='')


def _parse_aweme_item(aweme: dict) -> dict:
    """解析抖音内容条目（支持视频、图集、实况照片）"""
    aweme_id = aweme.get("aweme_id", "")
    aweme_type = aweme.get("aweme_type", 0)

    # 图集（aweme_type=68）或实况照片（aweme_type=69，含图片）
    if aweme_type in (68, 69):
        images = aweme.get("images", [])
        image_urls = []
        for img in images:
            url_list = img.get("url_list", [])
            if url_list:
                image_urls.append(url_list[0])

        # 实况照片：提取第一张图作为封面
        cover_url = image_urls[0] if image_urls else ""

        content_type = "live_photo" if aweme_type == 69 else "article"

        return {
            "content_type": content_type,
            "content_id": aweme_id,
            "content_url": f"https://www.douyin.com/note/{aweme_id}",
            "title": aweme.get("desc", "")[:200] if aweme.get("desc") else "",
            "cover_url": cover_url,
            "duration": 0,
            "author": aweme.get("author", {}).get("nickname", "") if aweme.get("author") else "",
            "description": aweme.get("desc", ""),
            "images": json.dumps(image_urls, ensure_ascii=False),
            "published_at": datetime.fromtimestamp(aweme.get("create_time", 0)) if aweme.get("create_time") else None,
            "raw_info": json.dumps(aweme, ensure_ascii=False, default=str),
        }

    # 普通视频（aweme_type=0）
    cover_url = ""
    video_info = aweme.get("video", {})
    if video_info:
        cover = video_info.get("cover", {})
        if cover and cover.get("url_list"):
            cover_url = cover["url_list"][0]
        elif video_info.get("play_addr", {}).get("url_list"):
            cover_url = video_info["play_addr"]["url_list"][0]

    return {
        "content_type": "video",
        "content_id": aweme_id,
        "content_url": f"https://www.douyin.com/video/{aweme_id}",
        "title": aweme.get("desc", "")[:200] if aweme.get("desc") else "",
        "cover_url": cover_url,
        "duration": video_info.get("duration", 0) // 1000 if video_info else 0,
        "author": aweme.get("author", {}).get("nickname", "") if aweme.get("author") else "",
        "description": aweme.get("desc", ""),
        "published_at": datetime.fromtimestamp(aweme.get("create_time", 0)) if aweme.get("create_time") else None,
        "raw_info": json.dumps(aweme, ensure_ascii=False, default=str),
    }


def fetch_douyin_user_videos(
    sec_uid: str,
    max_cursor: int = 0,
    count: int = 35,
    max_pages: int = 100,
    page_limit: int = None,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> DouyinFetchResult:
    """获取抖音用户视频列表（每页最多约35条）

    注意：抖音 API 游标分页在非零 cursor 时返回空数据，因此建议始终使用 cursor=0。
    单次请求最多可获取约 35-40 条视频，后续刷新应与已有数据对比去重。

    :param sec_uid: 抖音用户 sec_user_id（加密ID）
    :param max_cursor: 游标（建议始终使用 0）
    :param count: 每页数量（建议 35，上限约 40）
    :param max_pages: 最大页数限制
    :param page_limit: 分批获取限制
    :param progress_callback: 进度回调 (page, total_count)
    """
    results = []
    cursor = max_cursor
    pages_fetched = 0
    first_error = None
    has_more = False

    # 获取 Cookie
    try:
        cfm = _get_cookie_manager()
        cookie_str = cfm.get("douyin")
    except Exception:
        cookie_str = None

    if not cookie_str or 'ttwid' not in cookie_str or 'sessionid' not in cookie_str:
        return DouyinFetchResult(error="抖音 Cookie 缺少必要字段(ttwid/sessionid)，请在设置页重新配置")

    headers = {
        "User-Agent": DouyinConfig.HEADERS["User-Agent"],
        "Referer": "https://www.douyin.com/",
        "Cookie": cookie_str,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    while pages_fetched < max_pages:
        try:
            params = _build_douyin_params(sec_uid, cursor, count)
            params["msToken"] = _gen_ms_token()
            a_bogus = _sign_douyin_params(params)

            # 手动构建 URL（与 douyin_downloader.py 一致），避免 requests 自动编码导致签名不一致
            from urllib.parse import urlencode
            query_str = urlencode(params)
            full_url = f"{DOUYIN_API_URL}?{query_str}&a_bogus={a_bogus}"

            resp = requests.get(full_url, headers=headers, timeout=15)
            data = resp.json()

            status_code = data.get("status_code", -1)
            if status_code != 0:
                error_msg = data.get("status_msg", f"API 错误({status_code})")
                # 检测 cookie 过期特征
                cookie_expired_keywords = ["登录失效", "请登录", "session", "未登录", "需要登录", "权限", "验证"]
                if status_code == 8 or any(kw in error_msg for kw in cookie_expired_keywords):
                    error_msg = "抖音 Cookie 已过期，请在设置页重新配置"
                if first_error is None:
                    first_error = error_msg
                logger.error(f"抖音视频列表 API 错误: {error_msg}")
                break

            aweme_list = data.get("aweme_list", [])
            if not aweme_list:
                _cursor = data.get("max_cursor", 0)
                _has_more = data.get("has_more", False)
                logger.info(f"抖音用户 {sec_uid} 空页退出，已获取 {len(results)} 条，has_more={_has_more}, cursor={_cursor}")
                break

            for aweme in aweme_list:
                results.append(_parse_aweme_item(aweme))

            cursor = data.get("max_cursor", 0)
            has_more = data.get("has_more", False)

            logger.info(f"抖音用户 {sec_uid} 第 {pages_fetched + 1} 页获取成功，本页 {len(aweme_list)} 条，累计 {len(results)} 条，has_more={has_more}, next_cursor={cursor}")

            if progress_callback:
                progress_callback(pages_fetched + 1, len(results))

            pages_fetched += 1

            if not has_more:
                break

            if page_limit and pages_fetched >= page_limit:
                logger.info(f"分批获取：达到 page_limit={page_limit}，暂停")
                break

            time.sleep(DOUYIN_PAGE_INTERVAL)

        except requests.Timeout:
            if first_error is None:
                first_error = "请求超时"
            logger.error(f"抖音视频列表获取超时 (sec_uid={sec_uid})")
            break
        except Exception as e:
            if first_error is None:
                first_error = f"请求失败: {e}"
            logger.error(f"抖音视频列表获取失败: {e}")
            break

    return DouyinFetchResult(
        items=results,
        error=first_error,
        next_cursor=cursor,
        has_more=has_more,
    )


def _gen_ms_token() -> str:
    """生成 msToken"""
    try:
        import httpx
        payload = json.dumps({
            "magic": DouyinConfig.MS_TOKEN["magic"],
            "version": DouyinConfig.MS_TOKEN["version"],
            "dataType": DouyinConfig.MS_TOKEN["dataType"],
            "strData": DouyinConfig.MS_TOKEN["strData"],
            "tspFromClient": get_timestamp(),
        })
        client = httpx.Client()
        resp = client.post(
            DouyinConfig.MS_TOKEN["url"],
            content=payload,
            headers={"Content-Type": "application/json"},
        )
        return httpx.Cookies(resp.cookies).get("msToken") or ""
    except Exception:
        return ""


def _fetch_douyin_user_info(sec_uid: str) -> Optional[dict]:
    """调用抖音用户详情 API 获取用户信息（昵称、头像、抖音号）"""
    try:
        from app.services.cookie_manager import CookieConfigManager
        cfm = CookieConfigManager()
        cookie_str = cfm.get("douyin")
        if not cookie_str:
            logger.error("抖音 Cookie 未配置")
            return None

        params = BaseRequestModel().model_dump()
        params["sec_user_id"] = sec_uid

        bogus = ABogus()
        a_bogus = quote(bogus.get_value(params), safe='')

        query_str = urlencode(params)
        url = f"https://www.douyin.com/aweme/v1/web/user/profile/other/?{query_str}&a_bogus={a_bogus}"

        headers = {
            "User-Agent": DouyinConfig.HEADERS["User-Agent"],
            "Referer": "https://www.douyin.com/",
            "Cookie": cookie_str,
            "Accept": "application/json",
        }

        resp = requests.get(url, headers=headers, timeout=15)
        data = resp.json()

        status_code = data.get("status_code", -1)
        if status_code != 0:
            logger.error(f"抖音用户详情 API 错误: {data.get('status_msg', status_code)}")
            return None

        user = data.get("user", {})
        if not user:
            logger.error(f"抖音用户详情 API 返回空用户数据 ({sec_uid})")
            return None

        avatar_url = ""
        avatar_larger = user.get("avatar_larger", {})
        if avatar_larger and avatar_larger.get("url_list"):
            avatar_url = avatar_larger["url_list"][0]
        elif user.get("avatar_thumb", {}).get("url_list"):
            avatar_url = user["avatar_thumb"]["url_list"][0]

        return {
            "channel_name": user.get("nickname", ""),
            "avatar_url": avatar_url,
            "unique_id": user.get("unique_id", "") or (str(user.get("short_id", "")) if user.get("short_id") and str(user.get("short_id", "0")) != "0" else ""),
        }
    except Exception as e:
        logger.error(f"抖音用户信息获取异常 ({sec_uid}): {e}")
    return None