import json
from pathlib import Path
from typing import Optional, Dict
import re


class CookieConfigManager:
    def __init__(self, filepath: str = "config/downloader.json"):
        self.path = Path(filepath)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write({})

    def _read(self) -> Dict[str, Dict[str, str]]:
        try:
            with self.path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write(self, data: Dict[str, Dict[str, str]]):
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def convert_netscape_to_browser_cookie(netscape_cookie: str) -> str:
        """
        将 Netscape HTTP Cookie 格式转换为浏览器格式
        
        Args:
            netscape_cookie: Netscape 格式的 cookie 字符串（多行或单行，tab 分隔）
            
        Returns:
            浏览器格式的 cookie 字符串（键值对，分号分隔）
        """
        if not netscape_cookie or not netscape_cookie.strip():
            return ""
        
        # 检查是否已经是浏览器格式（包含 = 和 ; 但不包含 tab）
        if '=' in netscape_cookie and '\t' not in netscape_cookie and '; ' in netscape_cookie:
            return netscape_cookie

        # 单个键值对格式（如 key=value），直接返回
        if '=' in netscape_cookie and '\t' not in netscape_cookie:
            return netscape_cookie
        
        # 处理单行格式（用空格分隔多个 cookie 条目）
        # 例如: "www.douyin.com\tFALSE\t/\tFALSE\t0\tname\tvalue www.douyin.com\tFALSE..."
        # 先尝试按换行符分割，如果只有一行，则按特定模式分割
        lines = netscape_cookie.strip().split('\n')
        
        # 如果只有一行或几行，但包含多个域名，说明是压缩格式
        if len(lines) <= 3 and netscape_cookie.count('.douyin.com') > 5:
            # 使用正则表达式或简单的字符串处理来分割
            # 查找域名模式作为分隔符
            import re
            # 匹配域名开头的模式
            entries = re.split(r'(?=(?:www\.)?\.?douyin\.com\t)', netscape_cookie)
            lines = [entry.strip() for entry in entries if entry.strip()]
        
        cookies = []
        
        for line in lines:
            line = line.strip()
            # 跳过注释和空行
            if not line or line.startswith('#'):
                continue
            
            # Netscape 格式: domain flag path secure expiration name value
            parts = line.split('\t')
            if len(parts) >= 7:
                name = parts[5].strip()
                value = parts[6].strip()
                if name and value:
                    cookies.append(f"{name}={value}")
        
        return '; '.join(cookies)

    def get(self, platform: str, auto_convert: bool = True) -> Optional[str]:
        """
        获取指定平台的 cookie
        
        Args:
            platform: 平台名称
            auto_convert: 是否自动转换 Netscape 格式为浏览器格式
            
        Returns:
            cookie 字符串，如果不存在则返回 None
        """
        data = self._read()
        cookie = data.get(platform, {}).get("cookie")
        
        if not cookie:
            return None
        
        if auto_convert:
            # 自动检测并转换 Netscape 格式
            if '\t' in cookie or cookie.startswith('#'):
                cookie = self.convert_netscape_to_browser_cookie(cookie)
                # 如果转换后为空，返回 None
                if not cookie:
                    return None
        
        return cookie

    def set(self, platform: str, cookie: str, auto_convert: bool = True):
        """
        设置指定平台的 cookie
        
        Args:
            platform: 平台名称
            cookie: cookie 字符串
            auto_convert: 是否自动转换 Netscape 格式为浏览器格式
        """
        if auto_convert and cookie:
            cookie = self.convert_netscape_to_browser_cookie(cookie)
        
        data = self._read()
        data[platform] = {"cookie": cookie}
        self._write(data)

    def delete(self, platform: str):
        data = self._read()
        if platform in data:
            del data[platform]
            self._write(data)

    def list_all(self) -> Dict[str, str]:
        data = self._read()
        return {k: v.get("cookie", "") for k, v in data.items()}

    def exists(self, platform: str) -> bool:
        return self.get(platform) is not None
    
    def validate_cookie(self, platform: str, required_fields: list = None) -> tuple[bool, str]:
        """
        验证 cookie 是否有效
        
        Args:
            platform: 平台名称
            required_fields: 必需的 cookie 字段列表
            
        Returns:
            (是否有效, 错误信息)
        """
        cookie = self.get(platform)
        
        if not cookie:
            return False, f"{platform} cookie 未配置"
        
        if not cookie.strip():
            return False, f"{platform} cookie 为空"
        
        # 检查必需字段
        if required_fields:
            missing_fields = []
            for field in required_fields:
                # 支持两种格式: field= 或 field:
                if f"{field}=" not in cookie and f"{field}:" not in cookie:
                    missing_fields.append(field)
            
            if missing_fields:
                return False, f"{platform} cookie 缺少必需字段: {', '.join(missing_fields)}"
        
        return True, "Cookie 有效"