"""统一下载工具类 - 封装安全检查和文件下载逻辑"""
import socket
import ipaddress
import logging
import os
import requests
import time
from urllib.parse import urlparse
from requests.exceptions import ConnectionError, Timeout, ChunkedEncodingError
from urllib3.exceptions import IncompleteRead

logger = logging.getLogger(__name__)


class DownloadHelper:
    """统一下载工具类，所有下载逻辑应通过此类执行"""

    # CDN 白名单 - 可扩展，新增平台时在此添加
    TRUSTED_CDN_SUFFIXES = (
        "douyinpic.com",      # 抖音图片 CDN
        "douyinvod.com",      # 抖音视频 CDN（实况照片等）
        "douyinstatic.com",   # 抖音音乐 CDN
        "douyin.com",         # 抖音主站
        "byteimg.com",        # 字节跳动图片 CDN
        "bytedance.com",      # 字节跳动
        "hdslb.com",          # B站 CDN
        "bilibili.com",       # B站主站
        "xiaohongshu.com",    # 小红书主站
        "xhscdn.com",         # 小红书 CDN
        "sns-img-bd.xhscdn.com",  # 小红书图片
        "kuaishou.com",       # 快手
        "ksapisrv.com",       # 快手 CDN
        "yximgs.com",         # 快手图片 CDN
    )

    # 平台 Referer Header 映射
    REFERER_MAP = {
        "douyin": "https://www.douyin.com/",
        "bilibili": "https://www.bilibili.com/",
        "xiaohongshu": "https://www.xiaohongshu.com/",
        "kuaishou": "https://www.kuaishou.com/",
        "youtube": "https://www.youtube.com/",
    }

    @staticmethod
    def is_safe_url(url: str) -> tuple[bool, str]:
        """
        URL 安全检查，防止 SSRF 攻击。
        只允许 http/https，阻止内网/回环/链路本地 IP。
        已知 CDN 域名使用前导点匹配，仍检查私网 IP。

        Args:
            url: 待检查的 URL

        Returns:
            (is_safe, error_message)
        """
        try:
            parsed = urlparse(url)
            # 只允许 http/https
            if parsed.scheme not in ("http", "https"):
                logger.warning(f"URL 协议不安全: {parsed.scheme}")
                return False, f"不支持的协议: {parsed.scheme}"
            hostname = parsed.hostname
            if not hostname:
                return False, "URL 缺少主机名"

            hostname_lower = hostname.lower()

            # 禁止本地域名
            blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "ip6-localhost"]
            if hostname_lower in blocked or hostname_lower.endswith(".local"):
                return False, f"禁止访问本地域名: {hostname}"

            # 已知平台 CDN 域名白名单：这些域名的真实 IP 不可能是内网，
            # 但在 fake-ip 模式（Clash/Surge）下 DNS 可能解析到 198.18.x.x。
            # 对白名单域名跳过内网 IP 检查，避免误拦截。
            trusted_cdn_domains = [
                ".douyinpic.com", ".douyin.com", ".douyinvod.com",  # 抖音
                ".douyinstatic.com", ".bytestatic.com", ".bytegoofy.com",  # 抖音音乐/字节 CDN
                ".snssdk.com", ".byteimg.com", ".bytecdn.cn",       # 字节系
                ".amemv.com", ".ixigua.com",                         # 字节西瓜
                ".xhscdn.com", ".xiaohongshu.com",                   # 小红书
                ".kwaicdn.com", ".kuaishou.com",                     # 快手
                ".hdslb.com", ".bilivideo.com", ".bilibili.com",     # B站
                ".ytimg.com", ".googlevideo.com",                    # YouTube
                ".cctv.com", ".cntv.cn",                             # CCTV
            ]
            is_trusted_cdn = any(hostname_lower.endswith(d) for d in trusted_cdn_domains)

            # 检查是否为内网 IP（对非白名单域名检查，防止 SSRF）
            if not is_trusted_cdn:
                try:
                    ip = socket.gethostbyname(hostname)
                    ip_obj = ipaddress.ip_address(ip)
                    if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                        logger.warning(f"URL 解析为内网 IP: {hostname} -> {ip}")
                        return False, f"禁止访问内网地址: {ip}"
                except socket.gaierror:
                    return False, f"无法解析域名: {hostname}"

            return True, ""
        except Exception as e:
            logger.warning(f"URL 安全检查异常: {e}")
            return False, f"URL 解析失败: {e}"

    @staticmethod
    def download_file(
        url: str,
        output_path: str,
        filename: str,
        referer: str = None,
        timeout: int = 30,
        max_retries: int = 3,
        stream: bool = True,
    ) -> str:
        """
        统一文件下载方法，包含安全检查和重试机制。

        Args:
            url: 文件 URL
            output_path: 输出目录
            filename: 输出文件名
            referer: Referer Header（可选）
            timeout: 超时时间（秒），默认 30s
            max_retries: 最大重试次数，默认 3 次
            stream: 是否使用流式下载（大文件推荐），默认 True

        Returns:
            str: 本地文件路径，失败返回空字符串
        """
        is_safe, err = DownloadHelper.is_safe_url(url)
        if not is_safe:
            logger.warning(f"跳过不安全的 URL: {url[:80]}... 原因: {err}")
            return ""

        if not os.path.exists(output_path):
            os.makedirs(output_path, exist_ok=True)

        headers = {}
        if referer:
            headers["Referer"] = referer

        for attempt in range(1, max_retries + 1):
            try:
                resp = requests.get(url, headers=headers, timeout=timeout, stream=stream)
                if resp.status_code == 200:
                    file_path = os.path.join(output_path, filename)
                    if stream:
                        with open(file_path, "wb") as f:
                            for chunk in resp.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                    else:
                        with open(file_path, "wb") as f:
                            f.write(resp.content)
                    logger.info(f"文件下载成功: {file_path}")
                    return file_path
                else:
                    logger.warning(f"下载失败，状态码: {resp.status_code}, URL: {url[:80]}...")
                    if attempt < max_retries:
                        time.sleep(2)
                        continue
                    return ""
            except (ConnectionError, Timeout, IncompleteRead, ChunkedEncodingError) as e:
                logger.warning(f"下载网络异常 (尝试 {attempt}/{max_retries}): {e}, URL: {url[:80]}...")
                if attempt < max_retries:
                    time.sleep(3)
                    continue
                return ""
            except Exception as e:
                logger.warning(f"下载异常: {e}, URL: {url[:80]}...")
                if attempt < max_retries:
                    time.sleep(2)
                    continue
                return ""

        return ""

    @staticmethod
    def get_referer(platform: str) -> str:
        """
        获取平台对应的 Referer Header。

        Args:
            platform: 平台名称（douyin/bilibili/xiaohongshu 等）

        Returns:
            str: Referer Header 值
        """
        return DownloadHelper.REFERER_MAP.get(platform, "")