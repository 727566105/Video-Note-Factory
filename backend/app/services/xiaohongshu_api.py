"""小红书用户笔记列表分页获取 — Web API"""
import os
import json
import re
import time
from typing import Optional, Callable
from datetime import datetime

import requests

from app.downloaders.xiaohongshu_helper.signer import sign_post
from app.utils.logger import get_logger

logger = get_logger(__name__)

XHS_HOMEFEED_API = "https://edith.xiaohongshu.com/api/sns/web/v1/user_posted"
XHS_USER_PROFILE_API = "https://edith.xiaohongshu.com/api/sns/web/v1/user/otherinfo"
XHS_PAGE_INTERVAL = int(os.getenv("XHS_PAGE_INTERVAL", "3"))


class XiaohongshuFetchResult:
    """小红书获取结果"""
    def __init__(self, items=None, error=None, has_more=False, cursor=""):
        self.items = items or []
        self.error = error
        self.has_more = has_more
        self.cursor = cursor
        self.success = error is None


def _get_cookie_manager():
    from app.services.cookie_manager import CookieConfigManager
    return CookieConfigManager()


def _get_headers(cookie_str: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Referer": "https://www.xiaohongshu.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Content-Type": "application/json;charset=UTF-8",
        "Origin": "https://www.xiaohongshu.com",
        "Cookie": cookie_str,
    }


def _fix_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http://"):
        return "https://" + url[7:]
    return url


def _parse_note_card(card: dict) -> dict:
    """解析小红书笔记条目"""
    note_id = card.get("note_id", "")
    note_type = card.get("type", "")
    is_video = note_type == "video"

    cover_url = card.get("cover", {}).get("url", "")
    if not cover_url:
        cover_url = card.get("cover", {}).get("url_default", "")
    cover_url = _fix_url(cover_url)

    title = card.get("display_title", "") or card.get("title", "")

    # 时间
    timestamp = card.get("time", 0)
    published_at = datetime.fromtimestamp(timestamp / 1000) if timestamp else None

    # 时长
    duration = 0
    if is_video:
        duration = card.get("video", {}).get("duration", 0)
        if duration:
            duration = duration // 1000

    user = card.get("user", {})
    content_type = "video" if is_video else "article"

    return {
        "content_type": content_type,
        "content_id": note_id,
        "content_url": f"https://www.xiaohongshu.com/explore/{note_id}",
        "title": title[:200] if title else "",
        "cover_url": cover_url,
        "duration": duration,
        "author": user.get("nickname", ""),
        "description": card.get("desc", ""),
        "published_at": published_at,
        "raw_info": json.dumps(card, ensure_ascii=False, default=str),
    }


def fetch_xiaohongshu_user_notes(
    user_id: str,
    cursor: str = "",
    count: int = 30,
    max_pages: int = 100,
    page_limit: int = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> XiaohongshuFetchResult:
    """获取小红书用户笔记列表

    :param user_id: 小红书用户 ID
    :param cursor: 分页游标
    :param count: 每页数量
    :param max_pages: 最大页数
    :param page_limit: 分批获取限制
    :param progress_callback: 进度回调 (page, total_count)
    """
    results = []
    current_cursor = cursor
    pages_fetched = 0
    first_error = None
    has_more = False

    # 获取 Cookie
    try:
        cfm = _get_cookie_manager()
        cookie_str = cfm.get("xiaohongshu")
    except Exception:
        cookie_str = None

    if not cookie_str or 'a1' not in cookie_str or 'web_session' not in cookie_str:
        return XiaohongshuFetchResult(error="小红书 Cookie 缺少必要字段(a1/web_session)，请重新配置")

    while pages_fetched < max_pages:
        try:
            uri = "/api/sns/web/v1/user_posted"
            payload = {
                "user_id": user_id,
                "cursor": current_cursor,
                "num": count,
                "image_scenes": ["CRD_WM_WEBP"],
            }

            sign_headers = sign_post(uri, cookie_str, payload)
            headers = _get_headers(cookie_str)
            headers.update(sign_headers)

            resp = requests.post(
                f"https://edith.xiaohongshu.com{uri}",
                json=payload,
                headers=headers,
                timeout=15,
            )
            data = resp.json()

            if not data.get("success"):
                error_msg = data.get("msg", "API 错误")
                # 检测小红书 cookie 过期
                if any(kw in str(error_msg).lower() for kw in ["登录", "login", "session", "请先", "无效"]):
                    error_msg = "小红书 Cookie 已过期，请在设置页重新配置"
                else:
                    error_msg = f"小红书 API 错误: {error_msg}"
                if first_error is None:
                    first_error = error_msg
                logger.error(f"小红书笔记列表 API 错误: {error_msg}")
                break

            notes = data.get("data", {}).get("notes", [])
            if not notes:
                logger.info(f"小红书用户 {user_id} 空页退出，已获取 {len(results)} 条")
                break

            for note_card in notes:
                results.append(_parse_note_card(note_card))

            has_more = data.get("data", {}).get("has_more", False)
            current_cursor = data.get("data", {}).get("cursor", "")

            logger.info(
                f"小红书用户 {user_id} 第 {pages_fetched + 1} 页获取成功，"
                f"本页 {len(notes)} 条，累计 {len(results)} 条，has_more={has_more}"
            )

            if progress_callback:
                progress_callback(pages_fetched + 1, len(results))

            pages_fetched += 1

            if not has_more:
                break

            if page_limit and pages_fetched >= page_limit:
                logger.info(f"分批获取：达到 page_limit={page_limit}，暂停")
                break

            time.sleep(XHS_PAGE_INTERVAL)

        except requests.Timeout:
            if first_error is None:
                first_error = "请求超时"
            logger.error(f"小红书笔记列表获取超时 (user_id={user_id})")
            break
        except Exception as e:
            if first_error is None:
                first_error = f"请求失败: {e}"
            logger.error(f"小红书笔记列表获取失败: {e}")
            break

    return XiaohongshuFetchResult(
        items=results,
        error=first_error,
        has_more=has_more,
        cursor=current_cursor,
    )


def fetch_xiaohongshu_user_info(user_id: str) -> Optional[dict]:
    """获取小红书用户信息（昵称、头像、小红书号）"""
    try:
        cfm = _get_cookie_manager()
        cookie_str = cfm.get("xiaohongshu")
        if not cookie_str:
            logger.error("小红书 Cookie 未配置")
            return None

        uri = "/api/sns/web/v1/user/otherinfo"
        payload = {"target_user_id": user_id}

        sign_headers = sign_post(uri, cookie_str, payload)
        headers = _get_headers(cookie_str)
        headers.update(sign_headers)

        resp = requests.post(
            f"https://edith.xiaohongshu.com{uri}",
            json=payload,
            headers=headers,
            timeout=15,
        )
        data = resp.json()

        if not data.get("success"):
            logger.error(f"小红书用户详情 API 错误: {data.get('msg', 'unknown')}")
            return None

        user = data.get("data", {})
        if not user:
            return None

        avatar_url = _fix_url(user.get("image", ""))
        red_id = user.get("red_id", "") or user.get("redId", "")

        return {
            "channel_name": user.get("nickname", ""),
            "avatar_url": avatar_url,
            "unique_id": str(red_id) if red_id else "",
        }
    except Exception as e:
        logger.error(f"小红书用户信息获取异常 ({user_id}): {e}")
    return None
