#!/usr/bin/env python3
"""
Cookie 格式转换工具

用于将 Netscape HTTP Cookie 格式转换为浏览器格式
支持从文件读取或直接输入 cookie 字符串
"""

import sys
import json
from pathlib import Path

# 添加父目录到路径以便导入模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cookie_manager import CookieConfigManager


def convert_cookie_file(input_file: str, output_file: str = None):
    """
    从文件读取 Netscape 格式的 cookie 并转换
    
    Args:
        input_file: 输入文件路径
        output_file: 输出文件路径（可选）
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            netscape_cookie = f.read()
        
        cfm = CookieConfigManager()
        browser_cookie = cfm.convert_netscape_to_browser_cookie(netscape_cookie)
        
        print(f"✅ 成功转换 cookie，共 {len(browser_cookie.split(';'))} 个字段")
        print(f"📏 Cookie 长度: {len(browser_cookie)} 字符")
        print("\n转换后的 Cookie (前 200 字符):")
        print(browser_cookie[:200] + "..." if len(browser_cookie) > 200 else browser_cookie)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(browser_cookie)
            print(f"\n💾 已保存到: {output_file}")
        
        return browser_cookie
        
    except FileNotFoundError:
        print(f"❌ 错误: 文件不存在 - {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 转换失败: {e}")
        sys.exit(1)


def update_config(platform: str, cookie: str):
    """
    更新配置文件中的 cookie
    
    Args:
        platform: 平台名称 (douyin, bilibili, etc.)
        cookie: cookie 字符串
    """
    try:
        cfm = CookieConfigManager()
        cfm.set(platform, cookie, auto_convert=True)
        
        # 验证
        is_valid, msg = cfm.validate_cookie(platform, ['ttwid', 'sessionid'] if platform == 'douyin' else None)
        
        if is_valid:
            print(f"✅ 成功更新 {platform} 的 cookie")
            print(f"✅ Cookie 验证通过: {msg}")
        else:
            print(f"⚠️  Cookie 已更新但验证失败: {msg}")
            print("   请确保 cookie 包含所有必需字段")
        
    except Exception as e:
        print(f"❌ 更新配置失败: {e}")
        sys.exit(1)


def validate_config(platform: str):
    """
    验证配置文件中的 cookie
    
    Args:
        platform: 平台名称
    """
    try:
        cfm = CookieConfigManager()
        
        if not cfm.exists(platform):
            print(f"❌ {platform} 的 cookie 未配置")
            sys.exit(1)
        
        cookie = cfm.get(platform)
        print(f"📋 {platform} Cookie 信息:")
        print(f"   长度: {len(cookie)} 字符")
        print(f"   字段数: {len(cookie.split(';'))} 个")
        print(f"   前 100 字符: {cookie[:100]}...")
        
        # 验证必需字段
        required_fields = {
            'douyin': ['ttwid', 'sessionid', '__ac_signature'],
            'bilibili': ['SESSDATA', 'bili_jct'],
        }
        
        fields = required_fields.get(platform, [])
        is_valid, msg = cfm.validate_cookie(platform, fields)
        
        if is_valid:
            print(f"\n✅ Cookie 验证通过")
        else:
            print(f"\n❌ Cookie 验证失败: {msg}")
            
            # 显示缺失的字段
            print("\n🔍 检查 Cookie 字段:")
            for field in fields:
                exists = f"{field}=" in cookie
                status = "✅" if exists else "❌"
                print(f"   {status} {field}")
        
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        sys.exit(1)


def show_help():
    """显示帮助信息"""
    help_text = """
🍪 Cookie 格式转换工具

用法:
  python cookie_converter.py convert <input_file> [output_file]
      从文件读取 Netscape 格式的 cookie 并转换为浏览器格式
      
  python cookie_converter.py update <platform> <cookie_file>
      转换 cookie 并更新到配置文件
      
  python cookie_converter.py validate <platform>
      验证配置文件中的 cookie
      
  python cookie_converter.py help
      显示此帮助信息

示例:
  # 转换 cookie 文件
  python cookie_converter.py convert douyin_cookies.txt douyin_converted.txt
  
  # 更新抖音 cookie
  python cookie_converter.py update douyin douyin_cookies.txt
  
  # 验证抖音 cookie
  python cookie_converter.py validate douyin

支持的平台:
  - douyin (抖音)
  - bilibili (哔哩哔哩)
  - youtube
  - kuaishou (快手)
  - xiaoyuzhoufm (小宇宙)
"""
    print(help_text)


def main():
    """主函数"""
    if len(sys.argv) < 2:
        show_help()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == 'help' or command == '-h' or command == '--help':
        show_help()
        
    elif command == 'convert':
        if len(sys.argv) < 3:
            print("❌ 错误: 缺少输入文件参数")
            print("用法: python cookie_converter.py convert <input_file> [output_file]")
            sys.exit(1)
        
        input_file = sys.argv[2]
        output_file = sys.argv[3] if len(sys.argv) > 3 else None
        convert_cookie_file(input_file, output_file)
        
    elif command == 'update':
        if len(sys.argv) < 4:
            print("❌ 错误: 缺少参数")
            print("用法: python cookie_converter.py update <platform> <cookie_file>")
            sys.exit(1)
        
        platform = sys.argv[2]
        cookie_file = sys.argv[3]
        
        # 先转换
        browser_cookie = convert_cookie_file(cookie_file)
        print("\n" + "="*60)
        
        # 再更新
        update_config(platform, browser_cookie)
        
    elif command == 'validate':
        if len(sys.argv) < 3:
            print("❌ 错误: 缺少平台参数")
            print("用法: python cookie_converter.py validate <platform>")
            sys.exit(1)
        
        platform = sys.argv[2]
        validate_config(platform)
        
    else:
        print(f"❌ 未知命令: {command}")
        print("使用 'python cookie_converter.py help' 查看帮助")
        sys.exit(1)


if __name__ == '__main__':
    main()
