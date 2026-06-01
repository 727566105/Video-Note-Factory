import datetime
import json
import os
import re
import time
from typing import Union, Optional
from urllib.parse import quote, urlencode
import logging

import httpx
import requests
from pydantic import BaseModel

from app.downloaders.base import Downloader
from app.downloaders.douyin_helper.abogus import ABogus
from app.enmus.note_enums import DownloadQuality
from app.models.audio_model import AudioDownloadResult, VideoInfoResult
from app.services.cookie_manager import CookieConfigManager
from dotenv import load_dotenv

load_dotenv()
DOUYIN_DOMAIN = "https://www.douyin.com"

# 配置日志
logger = logging.getLogger(__name__)

cfm = CookieConfigManager()
def get_timestamp(unit: str = "milli"):
    """
    根据给定的单位获取当前时间 (Get the current time based on the given unit)

    Args:
        unit (str): 时间单位，可以是 "milli"、"sec"、"min" 等
            (The time unit, which can be "milli", "sec", "min", etc.)

    Returns:
        int: 根据给定单位的当前时间 (The current time based on the given unit)
    """

    now = datetime.datetime.utcnow() - datetime.datetime(1970, 1, 1)
    if unit == "milli":
        return int(now.total_seconds() * 1000)
    elif unit == "sec":
        return int(now.total_seconds())
    elif unit == "min":
        return int(now.total_seconds() / 60)
    else:
        raise ValueError("Unsupported time unit")


class DouyinConfig:
    HEADERS = {
        "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
        "Referer": "https://www.douyin.com/",
        "Cookie": None
    }

    PROXIES = {
        "http": None,
        "https": None,
    }

    MS_TOKEN = {
        "url": "https://mssdk.bytedance.com/web/report",
        "magic": 538969122,
        "version": 1,
        "dataType": 8,
        "strData": "fWOdJTQR3/jwmZqBBsPO6tdNEc1jX7YTwPg0Z8CT+j3HScLFbj2Zm1XQ7/lqgSutntVKLJWaY3Hc/+vc0h+So9N1t6EqiImu5jKyUa+S4NPy6cNP0x9CUQQgb4+RRihCgsn4QyV8jivEFOsj3N5zFQbzXRyOV+9aG5B5EAnwpn8C70llsWq0zJz1VjN6y2KZiBZRyonAHE8feSGpwMDeUTllvq6BG3AQZz7RrORLWNCLEoGzM6bMovYVPRAJipuUML4Hq/568bNb5vqAo0eOFpvTZjQFgbB7f/CtAYYmnOYlvfrHKBKvb0TX6AjYrw2qmNNEer2ADJosmT5kZeBsogDui8rNiI/OOdX9PVotmcSmHOLRfw1cYXTgwHXr6cJeJveuipgwtUj2FNT4YCdZfUGGyRDz5bR5bdBuYiSRteSX12EktobsKPksdhUPGGv99SI1QRVmR0ETdWqnKWOj/7ujFZsNnfCLxNfqxQYEZEp9/U01CHhWLVrdzlrJ1v+KJH9EA4P1Wo5/2fuBFVdIz2upFqEQ11DJu8LSyD43qpTok+hFG3Moqrr81uPYiyPHnUvTFgwA/TIE11mTc/pNvYIb8IdbE4UAlsR90eYvPkI+rK9KpYN/l0s9ti9sqTth12VAw8tzCQvhKtxevJRQntU3STeZ3coz9Dg8qkvaSNFWuBDuyefZBGVSgILFdMy33//l/eTXhQpFrVc9OyxDNsG6cvdFwu7trkAENHU5eQEWkFSXBx9Ml54+fa3LvJBoacfPViyvzkJworlHcYYTG392L4q6wuMSSpYUconb+0c5mwqnnLP6MvRdm/bBTaY2Q6RfJcCxyLW0xsJMO6fgLUEjAg/dcqGxl6gDjUVRWbCcG1NAwPCfmYARTuXQYbFc8LO+r6WQTWikO9Q7Cgda78pwH07F8bgJ8zFBbWmyrghilNXENNQkyIzBqOQ1V3w0WXF9+Z3vG3aBKCjIENqAQM9qnC14WMrQkfCHosGbQyEH0n/5R2AaVTE/ye2oPQBWG1m0Gfcgs/96f6yYrsxbDcSnMvsA+okyd6GfWsdZYTIK1E97PYHlncFeOjxySjPpfy6wJc4UlArJEBZYmgveo1SZAhmXl3pJY3yJa9CmYImWkhbpwsVkSmG3g11JitJXTGLIfqKXSAhh+7jg4HTKe+5KNir8xmbBI/DF8O/+diFAlD+BQd3cV0G4mEtCiPEhOvVLKV1pE+fv7nKJh0t38wNVdbs3qHtiQNN7JhY4uWZAosMuBXSjpEtoNUndI+o0cjR8XJ8tSFnrAY8XihiRzLMfeisiZxWCvVwIP3kum9MSHXma75cdCQGFBfFRj0jPn1JildrTh2vRgwG+KeDZ33BJ2VGw9PgRkztZ2l/W5d32jc7H91FftFFhwXil6sA23mr6nNp6CcrO7rOblcm5SzXJ5MA601+WVicC/g3p6A0lAnhjsm37qP+xGT+cbCFOfjexDYEhnqz0QZm94CCSnilQ9B/HBLhWOddp9GK0SABIk5i3xAH701Xb4HCcgAulvfO5EK0RL2eN4fb+CccgZQeO1Zzo4qsMHc13UG0saMgBEH8SqYlHz2S0CVHuDY5j1MSV0nsShjM01vIynw6K0T8kmEyNjt1eRGlleJ5lvE8vonJv7rAeaVRZ06rlYaxrMT6cK3RSHd2liE50Z3ik3xezwWoaY6zBXvCzljyEmqjNFgAPU3gI+N1vi0MsFmwAwFzYqqWdk3jwRoWLp//FnawQX0g5T64CnfAe/o2e/8o5/bvz83OsAAwZoR48GZzPu7KCIN9q4GBjyrePNx5Csq2srblifmzSKwF5MP/RLYsk6mEE15jpCMKOVlHcu0zhJybNP3AKMVllF6pvn+HWvUnLXNkt0A6zsfvjAva/tbLQiiiYi6vtheasIyDz3HpODlI+BCkV6V8lkTt7m8QJ1IcgTfqjQBummyjYTSwsQji3DdNCnlKYd13ZQa545utqu837FFAzOZQhbnC3bKqeJqO2sE3m7WBUMbRWLflPRqp/PsklN+9jBPADKxKPl8g6/NZVq8fB1w68D5EJlGExdDhglo4B0aihHhb1u3+zJ2DqkxkPCGBAZ2AcuFIDzD53yS4NssoWb4HJ7YyzPaJro+tgG9TshWRBtUw8Or3m0OtQtX+rboYn3+GxvD1O8vWInrg5qxnepelRcQzmnor4rHF6ZNhAJZAf18Rjncra00HPJBugY5rD+EwnN9+mGQo43b01qBBRYEnxy9JJYuvXxNXxe47/MEPOw6qsxN+dmyIWZSuzkw8K+iBM/anE11yfU4qTFt0veCaVprK6tXaFK0ZhGXDOYJd70sjIP4UrPhatp8hqIXSJ2cwi70B+TvlDk/o19CA3bH6YxrAAVeag1P9hmNlfJ7NxK3Jp7+Ny1Vd7JHWVF+R6rSJiXXPfsXi3ZEy0klJAjI51NrDAnzNtgIQf0V8OWeEVv7F8Rsm3/GKnjdNOcDKymi9agZUgtctENWbCXGFnI40NHuVHtBRZeYAYtwfV7v6U0bP9s7uZGpkp+OETHMv3AyV0MVbZwQvarnjmct4Z3Vma+DvT+Z4VlMVnkC2x2FLt26K3SIMz+KV2XLv5ocEdPFSn1vMR7zruCWC8XqAG288biHo/soldmb/nlw8o8qlfZj4h296K3hfdFubGIUtqgsrZCrLCkkRC08Cv1ozEX/y6t2YrQepwiNmwDVk5IufStVvJMj+y2r9TcYLv7UKWXx3P6aySvM2ZHPaZhv+6Z/A/jIMBSvOizn4qG11iK7Oo6JYhxCSMJZsetjsnL4ecSIAufEmoFlAScWBh6nFArRpVLvkAZ3tej7H2lWFRXIU7x7mdBfGqU82PpM6znKMMZCpEsvHqpkSPSL+Kwz2z1f5wW7BKcKK4kNZ8iveg9VzY1NNjs91qU8DJpUnGyM04C7KNMpeilEmoOxvyelMQdi85ndOVmigVKmy5JYlODNX744sHpeqmMEK/ux3xY5O406lm7dZlyGPSMrFWbm4rzqvSEIskP43+9xVP8L84GeHE4RpOHg3qh/shx+/WnT1UhKuKpByHCpLoEo144udpzZswCYSMp58uPrlwdVF31//AacTRk8dUP3tBlnSQPa1eTpXWFCn7vIiqOTXaRL//YQK+e7ssrgSUnwhuGKJ8aqNDgdsL+haVZnV9g5Qrju643adyNixvYFEp0uxzOzVkekOMh2FYnFVIL2mJYGpZEXlAIC0zQbb54rSP89j0G7soJ2HcOkD0NmMEWj/7hUdTuMin1lRNde/qmHjwhbhqL8Z9MEO/YG3iLMgFTgSNQQhyE8AZAAKnehmzjORJfbK+qxyiJ07J843EDduzOoYt9p/YLqyTFmAgpdfK0uYrtAJ47cbl5WWhVXp5/XUxwWdL7TvQB0Xh6ir1/XBRcsVSDrR7cPE221ThmW1EPzD+SPf2L2gS0WromZqj1PhLgk92YnnR9s7/nLBXZHPKy+fDbJT16QqabFKqAl9G0blyf+R5UGX2kN+iQp4VGXEoH5lXxNNTlgRskzrW7KliQXcac20oimAHUE8Phf+rXXglpmSv4XN3eiwfXwvOaAMVjMRmRxsKitl5iZnwpcdbsC4jt16g2r/ihlKzLIYju+XZej4dNMlkftEidyNg24IVimJthXY1H15RZ8Hm7mAM/JZrsxiAVI0A49pWEiUk3cyZcBzq/vVEjHUy4r6IZnKkRvLjqsvqWE95nAGMor+F0GLHWfBCVkuI51EIOknwSB1eTvLgwgRepV4pdy9cdp6iR8TZndPVCikflXYVMlMEJ2bJ2c0Swiq57ORJW6vQwnkxtPudpFRc7tNNDzz4LKEznJxAwGi6pBR7/co2IUgRw1ijLFTHWHQJOjgc7KaduHI0C6a+BJb4Y8IWuIk2u2qCMF1HNKFAUn/J1gTcqtIJcvK5uykpfJFCYc899TmUc8LMKI9nu57m0S44Y2hPPYeW4XSakScsg8bJHMkcXk3Tbs9b4eqiD+kHUhTS2BGfsHadR3d5j8lNhBPzA5e+mE==",
        "User-Agent": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.47"
    }

    TTWID = {
        "url": "https://ttwid.bytedance.com/ttwid/union/register/",
        "data": '{"region":"cn","aid":1768,"needFid":false,"service":"www.ixigua.com","migrate_info":{"ticket":"","source":"node"},"cbUrlProtocol":"https","union":true}'
    }


class BaseRequestModel(BaseModel):
    device_platform: str = "webapp"
    aid: str = "6383"
    channel: str = "channel_pc_web"
    pc_client_type: int = 1
    version_code: str = "290100"
    version_name: str = "29.1.0"
    cookie_enabled: str = "true"
    screen_width: int = 1920
    screen_height: int = 1080
    browser_language: str = "zh-CN"
    browser_platform: str = "Win32"
    browser_name: str = "Chrome"
    browser_version: str = "90.0.4430.212"
    browser_online: str = "true"
    engine_name: str = "Blink"
    engine_version: str = "90.0.4430.212"
    os_name: str = "Windows"
    os_version: str = "10"
    cpu_core_num: int = 12
    device_memory: int = 8
    platform: str = "PC"
    downlink: str = "10"
    effective_type: str = "4g"
    from_user_page: str = "1"
    locate_query: str = "false"
    need_time_list: str = "1"
    pc_libra_divert: str = "Windows"
    publish_video_strategy_type: str = "2"
    round_trip_time: str = "0"
    show_live_replay_strategy: str = "1"
    time_list_query: str = "0"
    whale_cut_token: str = ""
    update_version_code: str = "170400"
    msToken: str = None


class DouyinDownloader(Downloader):
    # 抖音 API 必需的 cookie 字段
    REQUIRED_COOKIE_FIELDS = ['ttwid', 'sessionid']
    
    def __init__(self, cookie=None):
        super().__init__()
        self.headers_config = DouyinConfig.HEADERS.copy()
        
        # 获取并转换 cookie
        cookie_str = cookie if cookie else cfm.get('douyin', auto_convert=True)
        
        if not cookie_str:
            logger.warning("抖音 cookie 未配置，API 请求可能失败")
        else:
            # 验证 cookie
            is_valid, error_msg = cfm.validate_cookie('douyin', self.REQUIRED_COOKIE_FIELDS)
            if not is_valid:
                logger.warning(f"抖音 cookie 验证失败: {error_msg}")
            else:
                logger.info("抖音 cookie 验证成功")
        
        self.headers_config["Cookie"] = cookie_str
        logger.debug(f"抖音下载器初始化完成，Cookie 长度: {len(cookie_str) if cookie_str else 0}")
        
        self.proxies_config = DouyinConfig.PROXIES.copy()
        self.ttwid_config = DouyinConfig.TTWID.copy()
        self.ms_token_config = DouyinConfig.MS_TOKEN.copy()
        self._cached_aweme_id = None
        self._cached_video_data = None

    @staticmethod
    def find_url(string: str) -> list:
        url = re.findall('http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', string)
        return url

    def extract_video_id(self, url: str) -> str:
        video_url = self.find_url(url)

        if len(video_url):
            video_url = video_url[0]
            try:
                # 使用带 Cookie 和 UA 的请求头，避免触发反爬验证
                response = requests.head(
                    video_url,
                    allow_redirects=True,
                    headers={
                        "User-Agent": DouyinConfig.HEADERS["User-Agent"],
                        "Cookie": self.headers_config.get("Cookie", "")
                    },
                    timeout=10
                )
                url = response.url
            except Exception as e:
                logger.warning(f"抖音短链接解析失败: {e}")
                return ""
        patterns = [
            r'video/(\d+)',
            r'note/(\d+)',
            r'aweme_id=(\d+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return ""

    def gen_real_msToken(self) -> str:
        try:
            payload = json.dumps(
                {
                    "magic": self.ms_token_config["magic"],
                    "version": self.ms_token_config["version"],
                    "dataType": self.ms_token_config["dataType"],
                    "strData": self.ms_token_config["strData"],
                    "tspFromClient": get_timestamp(),
                }
            )
            headers = {
                "User-Agent": self.headers_config["User-Agent"],
                "Content-Type": "application/json",
            }
            transport = httpx.HTTPTransport(retries=5)
            with httpx.Client(transport=transport) as client:
                try:
                    response = client.post(
                        self.ms_token_config["url"], content=payload, headers=headers
                    )
                    response.raise_for_status()

                    msToken = str(httpx.Cookies(response.cookies).get("msToken"))
                    if len(msToken) not in [120, 128]:
                        raise ValueError("响应内容：{0}， Douyin msToken API 的响应内容不符合要求。".format(msToken))

                    return msToken
                except Exception as e:
                    raise ValueError("Douyin msToken API 请求失败：{0}".format(e))
        except Exception as e:
            raise ValueError("Douyin msToken API{0}".format(e))

    def fetch_video_info(self, video_url: str) -> json:
        """
        获取抖音视频信息（带缓存，避免并行下载时重复请求）
        """
        try:
            aweme_id = self.extract_video_id(video_url)
            if not aweme_id:
                raise ValueError(f"无法从 URL 中提取视频 ID: {video_url}")

            # 缓存命中检查
            if self._cached_aweme_id == aweme_id and self._cached_video_data:
                logger.info(f"使用缓存的视频信息: {aweme_id}")
                return self._cached_video_data
            
            logger.info(f"开始获取抖音视频信息，aweme_id: {aweme_id}")
            
            # 构建请求参数
            kwargs = self.headers_config
            base_params = BaseRequestModel().model_dump()
            base_params["msToken"] = self.gen_real_msToken()
            base_params["aweme_id"] = aweme_id
            
            # 生成 a_bogus 签名
            bogus = ABogus()
            ab_value = bogus.get_value(base_params)
            a_bogus = quote(ab_value, safe='')
            
            # 构建完整 URL
            query_str = urlencode(base_params)
            full_url = f"{DOUYIN_DOMAIN}/aweme/v1/web/aweme/detail/?{query_str}&a_bogus={a_bogus}"
            
            logger.debug(f"请求 URL: {full_url[:200]}...")
            logger.debug(f"请求头 Cookie 长度: {len(kwargs.get('Cookie', ''))}")
            
            # 发送请求
            response = requests.get(full_url, headers=kwargs, timeout=30)
            
            logger.info(f"API 响应状态码: {response.status_code}")
            logger.debug(f"响应头: {dict(response.headers)}")
            
            # 检查状态码
            if response.status_code != 200:
                logger.error(f"API 返回错误状态码: {response.status_code}")
                logger.error(f"响应内容: {response.text[:500]}")
                raise ValueError(f"抖音 API 返回错误状态码: {response.status_code}")
            
            # 检查响应内容
            if not response.content:
                logger.error("API 返回空响应")
                raise ValueError("抖音 API 返回空响应，可能是 Cookie 失效或被反爬虫拦截")
            
            # 尝试解析 JSON
            try:
                json_data = response.json()
                logger.info("成功解析 JSON 响应")
                
                # 检查响应结构
                if 'aweme_detail' not in json_data:
                    logger.warning(f"响应中缺少 aweme_detail 字段，完整响应: {json.dumps(json_data, ensure_ascii=False)[:500]}")

                    # 检查是否有错误信息
                    if 'status_code' in json_data and json_data['status_code'] != 0:
                        error_msg = json_data.get('status_msg', '未知错误')
                        raise ValueError(f"抖音 API 返回错误: {error_msg}")

                    # aweme_detail 缺失但无错误码，抛出异常
                    raise ValueError(f"抖音 API 响应缺少 aweme_detail: {json.dumps(json_data, ensure_ascii=False)[:200]}")

                # 缓存结果
                self._cached_aweme_id = aweme_id
                self._cached_video_data = json_data
                return json_data
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失败: {e}")
                logger.error(f"响应内容类型: {response.headers.get('Content-Type')}")
                logger.error(f"响应前 1000 字符: {response.text[:1000]}")
                
                # 检查是否是 HTML 响应（可能是验证页面）
                if response.text.strip().startswith('<'):
                    raise ValueError(
                        "抖音 API 返回 HTML 页面而非 JSON，可能原因：\n"
                        "1. Cookie 已失效，需要重新获取\n"
                        "2. 触发了反爬虫验证\n"
                        "3. IP 被限制\n"
                        f"响应内容: {response.text[:200]}"
                    )
                else:
                    raise ValueError(f"抖音 API 返回无效的 JSON 数据: {response.text[:200]}")
                
        except requests.exceptions.Timeout:
            logger.error("请求超时")
            raise ValueError("抖音 API 请求超时，请检查网络连接")
        except requests.exceptions.RequestException as e:
            logger.error(f"请求异常: {e}")
            raise ValueError(f"抖音 API 请求失败: {e}")
        except Exception as e:
            logger.error(f"获取视频信息失败: {e}", exc_info=True)
            raise ValueError(f"获取抖音视频信息失败: {e}")

    def get_video_info(self, video_url: str) -> VideoInfoResult:
        """只获取视频元数据，不下载文件"""
        video_data = self.fetch_video_info(video_url)
        aweme = video_data.get('aweme_detail') or {}
        if not aweme:
            raise ValueError("抖音 API 返回数据缺少 aweme_detail")
        author_info = aweme.get('author') or {}
        aweme_type = aweme.get('aweme_type', 0)
        images = aweme.get('images') or []

        logger.info(f"aweme_type={aweme_type}, images_count={len(images)}")

        # 图集或实况照片：按 aweme_type 或 images 字段判断（兜底检测）
        if aweme_type in (68, 69) or images:
            images = aweme.get('images') or []
            image_urls = [img.get('url_list', [None])[0] for img in images if img.get('url_list')]
            cover_url = image_urls[0] if image_urls else None
            content_type = "live_photo" if aweme_type == 69 else "article"

            # 图集或实况照片：提取每张图片对应的视频URL（aweme_type 68/69 均可能含视频）
            images_with_video = []
            has_video = False
            for img in images:
                img_url = img.get('url_list', [None])[0] if img.get('url_list') else None
                video_data = img.get('video', {})
                video_url = None
                # 优先 play_addr
                play_addr = video_data.get('play_addr', {})
                if play_addr.get('url_list'):
                    video_url = play_addr['url_list'][0]
                # 兜底 download_addr
                if not video_url:
                    download_addr = video_data.get('download_addr', {})
                    if download_addr.get('url_list'):
                        video_url = download_addr['url_list'][0]
                if video_url:
                    has_video = True
                images_with_video.append({
                    "image_url": img_url,
                    "video_url": video_url,
                })
            # 只有存在视频时才标记为 live_photo
            if has_video:
                content_type = "live_photo"
                logger.info(f"图集含视频片段，标记为实况照片，共 {len(images_with_video)} 个视频URL")
            images_with_video = images_with_video if has_video else None

            return VideoInfoResult(
                title=aweme.get('item_title', '') or aweme.get('desc', ''),
                duration=0,
                cover_url=cover_url,
                platform="douyin",
                video_id=aweme.get('aweme_id', ''),
                author_id=str(author_info.get('uid', '')),
                author_name=author_info.get('nickname', ''),
                description=aweme.get('desc', ''),
                content_type=content_type,
                images_with_video=images_with_video,
                raw_info={
                    'tags': aweme.get('caption', ''),
                    'owner': {'name': author_info.get('nickname', '')},
                    'content_type': content_type,
                    'images': image_urls,
                    'aweme_type': aweme_type,
                    'images_with_video': images_with_video,
                },
            )

        # 普通视频：提取封面 URL
        cover = aweme.get('video', {}).get('cover_original_scale', {})
        cover_url_list = cover.get('url_list', [])
        cover_url = cover_url_list[0] if cover_url_list else None
        if not cover_url:
            cover_data = (aweme.get('video') or {}).get('cover') or {}
            cover_url_list = cover_data.get('url_list', [])
            cover_url = cover_url_list[0] if cover_url_list else None

        return VideoInfoResult(
            title=aweme.get('item_title', '') or aweme.get('desc', ''),
            duration=aweme.get('video', {}).get('duration', 0) or 0,
            cover_url=cover_url,
            platform="douyin",
            video_id=aweme.get('aweme_id', ''),
            author_id=str(author_info.get('uid', '')),
            author_name=author_info.get('nickname', ''),
            description=aweme.get('desc', ''),
            content_type="video",
            raw_info={
                'tags': aweme.get('caption', ''),
                'owner': {'name': author_info.get('nickname', '')},
                'content_type': 'video',
            },
        )

    def download(
            self,
            video_url: str,
            output_dir: Union[str, None] = None,
            quality: DownloadQuality = "fast",
            need_video: Optional[bool] = False
    ) -> AudioDownloadResult:
        try:
            print(
                f"正在下载内容: {video_url}，保存路径: {output_dir}，质量: {quality}"
            )
            if output_dir is None:
                raise ValueError("output_dir 不能为空，必须传入三级目录路径")
            os.makedirs(output_dir, exist_ok=True)

            video_data = self.fetch_video_info(video_url)
            aweme = video_data.get('aweme_detail') or {}
            if not aweme:
                raise ValueError("抖音 API 返回数据缺少 aweme_detail")
            aweme_type = aweme.get('aweme_type', 0)
            images = aweme.get('images') or []
            video_id = aweme.get('aweme_id', '')
            author_id = str(aweme.get('author', {}).get('uid', ''))
            author_name = aweme.get('author', {}).get('nickname', '') or None

            logger.info(f"download: aweme_type={aweme_type}, images_count={len(images)}")

            # 图集或实况照片：按 aweme_type 或 images 字段判断（兜底检测）
            if aweme_type in (68, 69) or images:
                images = aweme.get('images') or []
                downloaded_paths = []
                for i, img in enumerate(images):
                    url_list = img.get('url_list', [])
                    if url_list:
                        img_path = self._download_image(url_list[0], output_dir, f"image_{i+1}.jpg")
                        if img_path:
                            downloaded_paths.append(img_path)

                content_type = "live_photo" if aweme_type == 69 else "article"
                cover_url = downloaded_paths[0] if downloaded_paths else None

                # 实况照片：尝试下载短视频
                if aweme_type == 69:
                    live_photo = aweme.get('live_photo', {})
                    video_url_live = live_photo.get('video', {}).get('download_addr', {}).get('url_list', [None])[0]
                    if video_url_live:
                        try:
                            video_path = self._download_image(video_url_live, output_dir, f"live_video.mp4")
                        except Exception:
                            video_path = None
                    else:
                        video_path = None

                return AudioDownloadResult(
                    file_path=None,
                    title=aweme.get('item_title', '') or aweme.get('desc', ''),
                    duration=0,
                    cover_url=cover_url,
                    platform="douyin",
                    video_id=video_id,
                    content_type=content_type,
                    images=downloaded_paths,
                    author_id=author_id,
                    author_name=author_name,
                    description=aweme.get('desc', ''),
                    raw_info={
                        'content_type': content_type,
                        'images': downloaded_paths,
                        'aweme_type': aweme_type,
                    },
                )

            # 普通视频：下载音频
            output_path = os.path.join(output_dir, f"{video_id}.mp3")
            music_url = (aweme.get('music') or {}).get('play_url', {}).get('uri') or ''

            if music_url:
                from app.utils.download_helper import DownloadHelper
                if not DownloadHelper.is_safe_url(music_url):
                    raise ValueError(f"音频下载链接无效: {music_url[:50]}")
                audio_data = requests.get(music_url, timeout=30)
                with open(output_path, 'wb') as f:
                    f.write(audio_data.content)
            else:
                # 音频链接为空时，从已下载的视频中提取音频
                video_file = os.path.join(output_dir, f"{video_id}.mp4")

                # 并行下载时视频线程可能还在下载，等待文件写入完成
                if not os.path.exists(video_file) or os.path.getsize(video_file) == 0:
                    prev_size = 0
                    for _ in range(60):
                        time.sleep(2)
                        if os.path.exists(video_file) and os.path.getsize(video_file) > 0:
                            curr_size = os.path.getsize(video_file)
                            if curr_size == prev_size and curr_size > 0:
                                break
                            prev_size = curr_size

                if os.path.exists(video_file):
                    import subprocess
                    subprocess.run(
                        ['ffmpeg', '-i', video_file, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', output_path],
                        capture_output=True, timeout=120
                    )
                else:
                    raise ValueError("无法获取音频下载链接，且视频文件不存在")
            tags = []
            for tag in aweme.get('video_tag', []):
                if tag.get('tag_name'):
                    tags.append(tag['tag_name'])

            # 提取封面 URL（安全链式取值）
            video_info = aweme.get('video') or {}
            cover_url = None
            cover_original = video_info.get('cover_original_scale') or {}
            url_list = cover_original.get('url_list') or []
            if url_list:
                cover_url = url_list[0]
            else:
                cover_data = video_info.get('cover') or {}
                url_list = cover_data.get('url_list') or []
                if url_list:
                    cover_url = url_list[0]
                else:
                    big_thumbs = video_data.get('video') or {}
                    img_url = (big_thumbs.get('big_thumbs') or {}).get('img_url')
                    if img_url:
                        cover_url = img_url

            # 下载封面到视频目录
            if cover_url and output_dir:
                try:
                    from app.utils.download_helper import DownloadHelper
                    temp_cover = DownloadHelper.download_file(
                        cover_url, output_dir, "_temp_cover.jpg",
                        referer="https://www.douyin.com/", timeout=10
                    )
                    if temp_cover:
                        from app.utils.video_helper import save_cover_to_video_dir
                        cover_url = save_cover_to_video_dir(
                            temp_cover, output_dir, "douyin", author_id, video_id
                        )
                        os.remove(temp_cover)
                except Exception:
                    pass

            return AudioDownloadResult(
                file_path=output_path,
                title=aweme.get('item_title', '') or aweme.get('desc', ''),
                duration=aweme.get('video', {}).get('duration', 0) or 0,
                cover_url=cover_url,
                platform="douyin",
                video_id=video_id,
                raw_info={
                    'tags': aweme.get('caption', '') + ''.join(tags),
                    'owner': {
                        'name': author_name or '',
                    },
                    'uploader': author_name or '',
                    'width': aweme.get('video', {}).get('width', 0),
                    'height': aweme.get('video', {}).get('height', 0),
                    'content_type': 'video',
                },
                video_path=None,
                author_id=author_id,
                author_name=author_name,
            )
        except Exception as e:
            raise e

    @staticmethod
    def _download_image(url: str, output_dir: str, filename: str) -> str:
        """下载单张图片到指定目录（使用统一下载工具）"""
        from app.utils.download_helper import DownloadHelper
        return DownloadHelper.download_file(
            url, output_dir, filename,
            referer="https://www.douyin.com/", timeout=15
        )

    def download_video(self, video_url: str, output_dir: Union[str, None] = None, force_redownload: bool = False) -> str:

        try:

            if output_dir is None:
                raise ValueError("output_dir 不能为空，必须传入三级目录路径")
            os.makedirs(output_dir, exist_ok=True)

            video_id = self.extract_video_id(video_url)
            video_path = os.path.join(output_dir, f"{video_id}.mp4")
            if os.path.exists(video_path) and not force_redownload:
                logger.info(f"视频已缓存，跳过下载：{video_path}")
                return video_path

            # 如果强制重新下载且旧文件存在，先删除
            if os.path.exists(video_path) and force_redownload:
                os.remove(video_path)
                logger.info(f"强制重新下载，已删除旧视频：{video_path}")

            output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

            video_data = self.fetch_video_info(video_url)
            aweme_detail = video_data.get('aweme_detail') or {}
            if not aweme_detail:
                raise ValueError("抖音 API 返回数据缺少 aweme_detail")
            output_path = output_path % {
                "id": aweme_detail.get('aweme_id', ''),
                "ext": "mp4",
            }

            # ⛳ 无水印下载：bit_rate 优先选择 1080p
            video_info = aweme_detail.get('video') or {}
            url = None

            # 1. 优先：bit_rate 按分辨率选择 1080p
            bit_rate = video_info.get('bit_rate', [])
            if bit_rate:
                for br in bit_rate:
                    gear = br.get('gear_name', '')
                    if '1080' in gear:
                        play_addr = br.get('play_addr', {})
                        url_list = play_addr.get('url_list', [])
                        if url_list:
                            url = url_list[0]
                            logger.info(f"无水印视频：bit_rate[{gear}] 1080p")
                            break
                if not url:
                    br = bit_rate[0]
                    play_addr = br.get('play_addr', {})
                    url_list = play_addr.get('url_list', [])
                    if url_list:
                        url = url_list[0]
                        logger.info(f"无水印视频：bit_rate[{br.get('gear_name', 'N/A')}]")

            # 2. 兜底：顶层 play_addr
            if not url:
                play_addr = video_info.get('play_addr', {})
                url_list = play_addr.get('url_list', [])
                if url_list:
                    url = url_list[0]
                    logger.info(f"无水印视频：顶层 play_addr")

            # 3. 最后兜底：download_addr（有水印，但保证可用）
            if not url:
                download_addr = video_info.get('download_addr', {})
                url_list = download_addr.get('url_list', [])
                if url_list:
                    url = url_list[0]
                    logger.warning(f"兜底使用 download_addr（可能有水印）")

            if not url:
                raise ValueError("无法获取视频下载链接")

            from app.utils.download_helper import DownloadHelper
            if not DownloadHelper.is_safe_url(url):
                raise ValueError(f"视频下载链接无效: {url[:50]}")

            logger.info(f"视频下载 URL（前100字符）: {url[:100]}")
            _data = requests.get(url, allow_redirects=True, headers=self.headers_config, timeout=60)

            with open(output_path, 'wb') as f:
                f.write(_data.content)

            return output_path
        except Exception as e:
            logger.error(f"视频下载失败: {e}")
            raise ValueError(f"视频下载失败: {e}")



if __name__ == '__main__':
    dy = DouyinDownloader(
        cookie='')

    dy.download(
        '7.43 11/16 gba:/ j@P.xS 以“马成钢”的视角打开《抓娃娃》笼中鸟，何时飞 # 独白 # 人物故事  https://v.douyin.com/0pcFVdG_lx4/ 复制此链接，打开Dou音搜索，直接观看视频！'
    )
