"""SSRF 防护工具：校验外部 URL 是否安全连接。

统一供 WebDAV / Siyuan / Obsidian / image_proxy / check_remote_status 等使用。
"""
import ipaddress
import socket
from urllib.parse import urlparse


def validate_safe_url(url: str) -> tuple[bool, str]:
    """
    校验 URL 是否可安全发起请求（防止 SSRF）。

    规则：
    - 只允许 http/https
    - 禁止 localhost / .local
    - 解析 DNS 后禁止私网、回环、链路本地、元数据地址

    Returns:
        (is_safe, error_message)
    """
    if not url:
        return False, "URL 为空"

    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"URL 解析失败: {e}"

    if parsed.scheme not in ("http", "https"):
        return False, f"只允许 HTTP/HTTPS 协议: {parsed.scheme}"

    hostname = parsed.hostname
    if not hostname:
        return False, "URL 缺少主机名"

    hostname_lower = hostname.lower()

    # 禁止本地域名
    blocked_hostnames = {"localhost", "local", "localhost.localdomain", "ip6-localhost"}
    if hostname_lower in blocked_hostnames or hostname_lower.endswith(".local"):
        return False, f"禁止访问本地域名: {hostname}"

    # 如果 hostname 本身就是 IP，直接检查
    try:
        ip = ipaddress.ip_address(hostname)
        if _is_unsafe_ip(ip):
            return False, f"禁止访问内网地址: {ip}"
    except ValueError:
        # 不是 IP，走 DNS 解析
        try:
            resolved = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(resolved)
            if _is_unsafe_ip(ip):
                return False, f"域名解析为内网地址: {hostname} -> {ip}"
        except socket.gaierror:
            return False, f"无法解析域名: {hostname}"

    return True, ""


def _is_unsafe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """检查 IP 是否为不安全地址（私网/回环/链路本地/元数据等）"""
    if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        return True

    # AWS / 云元数据地址 169.254.169.254 已被 is_link_local 覆盖

    # IPv4 私网段
    if ip.version == 4:
        ip_int = int(ip)
        # 10.0.0.0/8
        if 10 * 256**3 <= ip_int < 11 * 256**3:
            return True
        # 172.16.0.0/12
        if 172 * 256**3 + 16 * 256**2 <= ip_int < 172 * 256**3 + 32 * 256**2:
            return True
        # 192.168.0.0/16
        if 192 * 256**3 + 168 * 256**2 <= ip_int < 192 * 256**3 + 169 * 256**2:
            return True
        # 100.64.0.0/10 (CGNAT)
        if 100 * 256**3 + 64 * 256**2 <= ip_int < 100 * 256**3 + 128 * 256**2:
            return True
        return False

    # IPv6
    return ip.is_private
