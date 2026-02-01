#!/usr/bin/env python3
"""
快速测试脚本 - 验证 Cookie 配置是否正常
"""

import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cookie_manager import CookieConfigManager

def main():
    print("🔍 快速检查 Cookie 配置...\n")
    
    cfm = CookieConfigManager()
    
    # 检查配置文件路径
    print(f"📁 配置文件: {cfm.path}")
    print(f"   存在: {'✅' if cfm.path.exists() else '❌'}")
    
    # 检查 Cookie
    cookie = cfm.get('douyin')
    
    if not cookie:
        print("\n❌ Cookie 未配置或为空")
        print("\n请运行: python fix_douyin_cookie.py")
        sys.exit(1)
    
    print(f"\n✅ Cookie 已配置")
    print(f"   长度: {len(cookie)} 字符")
    print(f"   字段数: {len(cookie.split(';'))} 个")
    
    # 检查必需字段
    required_fields = ['ttwid', 'sessionid']
    missing = []
    
    for field in required_fields:
        if f"{field}=" in cookie:
            print(f"   ✅ {field}")
        else:
            print(f"   ❌ {field}")
            missing.append(field)
    
    if missing:
        print(f"\n⚠️  缺少必需字段: {', '.join(missing)}")
        print("请重新获取完整的 Cookie")
        sys.exit(1)
    
    print("\n🎉 Cookie 配置正常！")
    print("\n下一步:")
    print("  测试 API: python test_douyin_downloader.py api <video_url>")

if __name__ == '__main__':
    main()
