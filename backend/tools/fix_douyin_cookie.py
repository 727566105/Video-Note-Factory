#!/usr/bin/env python3
"""
抖音 Cookie 快速修复工具

自动检测并修复 backend/config/downloader.json 中的抖音 Cookie 格式问题
"""

import sys
import json
from pathlib import Path

# 添加父目录到路径以便导入模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cookie_manager import CookieConfigManager


def main():
    """主函数"""
    print("="*60)
    print("🔧 抖音 Cookie 快速修复工具")
    print("="*60)
    
    # 检查两个可能的配置文件位置
    config_paths = [
        Path(__file__).parent.parent / "config" / "downloader.json",  # backend/config
        Path(__file__).parent.parent.parent / "config" / "downloader.json",  # 根目录 config
    ]
    
    # 找到存在的配置文件
    config_path = None
    for path in config_paths:
        if path.exists():
            config_path = path
            break
    
    if not config_path:
        # 使用第一个路径创建
        config_path = config_paths[0]
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, 'w') as f:
            json.dump({}, f)
    
    print(f"\n📁 配置文件: {config_path}")
    
    # 读取当前配置
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except Exception as e:
        print(f"❌ 读取配置文件失败: {e}")
        sys.exit(1)
    
    # 检查抖音配置
    if 'douyin' not in config:
        print("\n⚠️  配置文件中没有抖音配置")
        print("\n请先添加抖音 Cookie:")
        print("  python cookie_converter.py update douyin <cookie_file>")
        sys.exit(1)
    
    douyin_config = config.get('douyin', {})
    original_cookie = douyin_config.get('cookie', '')
    
    if not original_cookie:
        print("\n⚠️  抖音 Cookie 为空")
        print("\n请先添加抖音 Cookie:")
        print("  python cookie_converter.py update douyin <cookie_file>")
        sys.exit(1)
    
    print(f"\n📊 当前 Cookie 信息:")
    print(f"   长度: {len(original_cookie)} 字符")
    print(f"   前 100 字符: {original_cookie[:100]}...")
    
    # 检测格式
    is_netscape = '\t' in original_cookie or original_cookie.startswith('#')
    
    if is_netscape:
        print(f"\n🔍 检测到 Netscape 格式 Cookie")
        print("   正在转换为浏览器格式...")
        
        # 转换格式
        cfm = CookieConfigManager()
        browser_cookie = cfm.convert_netscape_to_browser_cookie(original_cookie)
        
        if not browser_cookie:
            print("❌ 转换失败，Cookie 可能格式不正确")
            sys.exit(1)
        
        print(f"✅ 转换成功")
        print(f"   新长度: {len(browser_cookie)} 字符")
        print(f"   字段数: {len(browser_cookie.split(';'))} 个")
        
        # 验证必需字段
        required_fields = ['ttwid', 'sessionid']
        missing_fields = []
        
        for field in required_fields:
            if f"{field}=" not in browser_cookie:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"\n⚠️  警告: Cookie 缺少必需字段: {', '.join(missing_fields)}")
            print("   API 请求可能会失败")
            print("\n建议:")
            print("   1. 确保已登录抖音网页版")
            print("   2. 重新导出完整的 Cookie")
        else:
            print(f"\n✅ Cookie 包含所有必需字段")
        
        # 备份原配置
        backup_path = config_path.with_suffix('.json.backup')
        print(f"\n💾 备份原配置到: {backup_path}")
        
        try:
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️  备份失败: {e}")
        
        # 更新配置
        config['douyin']['cookie'] = browser_cookie
        
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print(f"✅ 配置文件已更新")
            
            # 同步到其他配置文件位置
            other_config_paths = [p for p in config_paths if p != config_path and p.parent.exists()]
            for other_path in other_config_paths:
                try:
                    with open(other_path, 'w', encoding='utf-8') as f:
                        json.dump(config, f, ensure_ascii=False, indent=2)
                    print(f"✅ 已同步到: {other_path}")
                except Exception as e:
                    print(f"⚠️  同步到 {other_path} 失败: {e}")
                    
        except Exception as e:
            print(f"❌ 更新配置文件失败: {e}")
            sys.exit(1)
        
        print("\n" + "="*60)
        print("🎉 修复完成！")
        print("="*60)
        print("\n下一步:")
        print("  1. 验证 Cookie: python cookie_converter.py validate douyin")
        print("  2. 测试下载: python test_douyin_downloader.py api <video_url>")
        
    else:
        print(f"\n✅ Cookie 已经是浏览器格式")
        
        # 验证必需字段
        required_fields = ['ttwid', 'sessionid']
        missing_fields = []
        
        for field in required_fields:
            if f"{field}=" not in original_cookie:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"\n⚠️  警告: Cookie 缺少必需字段: {', '.join(missing_fields)}")
            print("\n🔍 检查字段:")
            for field in required_fields:
                exists = f"{field}=" in original_cookie
                status = "✅" if exists else "❌"
                print(f"   {status} {field}")
            
            print("\n建议:")
            print("   1. 确保已登录抖音网页版")
            print("   2. 重新导出完整的 Cookie")
            print("   3. 使用: python cookie_converter.py update douyin <cookie_file>")
        else:
            print(f"✅ Cookie 包含所有必需字段")
            print("\n✅ 无需修复，配置正常！")
            print("\n可以运行测试:")
            print("  python test_douyin_downloader.py api <video_url>")


if __name__ == '__main__':
    main()
