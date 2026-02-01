#!/usr/bin/env python3
"""
抖音下载器测试工具

用于测试抖音下载器的各项功能，包括：
- Cookie 验证
- 视频 ID 提取
- API 请求
- 视频信息获取
"""

import sys
import json
from pathlib import Path

# 添加父目录到路径以便导入模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.downloaders.douyin_downloader import DouyinDownloader
from app.services.cookie_manager import CookieConfigManager
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)


def test_cookie():
    """测试 Cookie 配置"""
    print("\n" + "="*60)
    print("🍪 测试 Cookie 配置")
    print("="*60)
    
    cfm = CookieConfigManager()
    
    if not cfm.exists('douyin'):
        print("❌ 抖音 cookie 未配置")
        print("\n请先配置 cookie:")
        print("  1. 使用浏览器登录抖音网页版")
        print("  2. 导出 cookie (使用浏览器插件如 EditThisCookie)")
        print("  3. 运行: python cookie_converter.py update douyin <cookie_file>")
        return False
    
    cookie = cfm.get('douyin')
    print(f"✅ Cookie 已配置")
    print(f"   长度: {len(cookie)} 字符")
    print(f"   字段数: {len(cookie.split(';'))} 个")
    
    # 验证必需字段
    required_fields = ['ttwid', 'sessionid', '__ac_signature']
    is_valid, msg = cfm.validate_cookie('douyin', required_fields)
    
    if is_valid:
        print(f"✅ Cookie 验证通过")
    else:
        print(f"⚠️  Cookie 验证警告: {msg}")
        print("\n🔍 检查必需字段:")
        for field in required_fields:
            exists = f"{field}=" in cookie
            status = "✅" if exists else "❌"
            print(f"   {status} {field}")
    
    return True


def test_video_id_extraction():
    """测试视频 ID 提取"""
    print("\n" + "="*60)
    print("🔍 测试视频 ID 提取")
    print("="*60)
    
    downloader = DouyinDownloader()
    
    test_urls = [
        "https://www.douyin.com/video/7345492945006595379",
        "https://v.douyin.com/0pcFVdG_lx4/",
        "7.43 11/16 gba:/ j@P.xS 以"马成钢"的视角打开《抓娃娃》笼中鸟，何时飞 # 独白 # 人物故事  https://v.douyin.com/0pcFVdG_lx4/ 复制此链接，打开Dou音搜索，直接观看视频！",
    ]
    
    for url in test_urls:
        video_id = downloader.extract_video_id(url)
        if video_id:
            print(f"✅ 提取成功: {video_id}")
            print(f"   来源: {url[:60]}...")
        else:
            print(f"❌ 提取失败: {url[:60]}...")
    
    return True


def test_api_request(video_url: str):
    """测试 API 请求"""
    print("\n" + "="*60)
    print("🌐 测试 API 请求")
    print("="*60)
    
    try:
        downloader = DouyinDownloader()
        
        print(f"📹 视频 URL: {video_url}")
        
        # 提取视频 ID
        video_id = downloader.extract_video_id(video_url)
        if not video_id:
            print("❌ 无法提取视频 ID")
            return False
        
        print(f"✅ 视频 ID: {video_id}")
        
        # 获取视频信息
        print("\n🔄 正在请求 API...")
        video_info = downloader.fetch_video_info(video_url)
        
        print("✅ API 请求成功")
        
        # 显示视频信息
        if 'aweme_detail' in video_info:
            detail = video_info['aweme_detail']
            print("\n📋 视频信息:")
            print(f"   标题: {detail.get('desc', 'N/A')}")
            print(f"   作者: {detail.get('author', {}).get('nickname', 'N/A')}")
            print(f"   点赞: {detail.get('statistics', {}).get('digg_count', 0)}")
            print(f"   评论: {detail.get('statistics', {}).get('comment_count', 0)}")
            print(f"   分享: {detail.get('statistics', {}).get('share_count', 0)}")
            
            # 保存完整响应
            output_file = f"douyin_video_{video_id}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(video_info, f, ensure_ascii=False, indent=2)
            print(f"\n💾 完整响应已保存到: {output_file}")
        else:
            print("\n⚠️  响应中缺少 aweme_detail 字段")
            print(f"响应内容: {json.dumps(video_info, ensure_ascii=False)[:500]}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ API 请求失败: {e}")
        return False


def test_download(video_url: str):
    """测试视频下载"""
    print("\n" + "="*60)
    print("⬇️  测试视频下载")
    print("="*60)
    
    try:
        downloader = DouyinDownloader()
        
        print(f"📹 视频 URL: {video_url}")
        print("\n🔄 正在下载...")
        
        result = downloader.download(video_url)
        
        print("✅ 下载成功")
        print(f"\n📋 下载结果:")
        print(f"   文件路径: {result.file_path}")
        print(f"   标题: {result.title}")
        print(f"   时长: {result.duration}ms")
        print(f"   平台: {result.platform}")
        print(f"   视频 ID: {result.video_id}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        return False


def show_help():
    """显示帮助信息"""
    help_text = """
🧪 抖音下载器测试工具

用法:
  python test_douyin_downloader.py cookie
      测试 Cookie 配置
      
  python test_douyin_downloader.py extract
      测试视频 ID 提取
      
  python test_douyin_downloader.py api <video_url>
      测试 API 请求
      
  python test_douyin_downloader.py download <video_url>
      测试视频下载
      
  python test_douyin_downloader.py all <video_url>
      运行所有测试
      
  python test_douyin_downloader.py help
      显示此帮助信息

示例:
  # 测试 Cookie
  python test_douyin_downloader.py cookie
  
  # 测试 API 请求
  python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"
  
  # 测试下载
  python test_douyin_downloader.py download "https://v.douyin.com/0pcFVdG_lx4/"
  
  # 运行所有测试
  python test_douyin_downloader.py all "https://www.douyin.com/video/7345492945006595379"
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
        
    elif command == 'cookie':
        success = test_cookie()
        sys.exit(0 if success else 1)
        
    elif command == 'extract':
        success = test_video_id_extraction()
        sys.exit(0 if success else 1)
        
    elif command == 'api':
        if len(sys.argv) < 3:
            print("❌ 错误: 缺少视频 URL 参数")
            print("用法: python test_douyin_downloader.py api <video_url>")
            sys.exit(1)
        
        video_url = sys.argv[2]
        success = test_api_request(video_url)
        sys.exit(0 if success else 1)
        
    elif command == 'download':
        if len(sys.argv) < 3:
            print("❌ 错误: 缺少视频 URL 参数")
            print("用法: python test_douyin_downloader.py download <video_url>")
            sys.exit(1)
        
        video_url = sys.argv[2]
        success = test_download(video_url)
        sys.exit(0 if success else 1)
        
    elif command == 'all':
        if len(sys.argv) < 3:
            print("❌ 错误: 缺少视频 URL 参数")
            print("用法: python test_douyin_downloader.py all <video_url>")
            sys.exit(1)
        
        video_url = sys.argv[2]
        
        results = []
        results.append(("Cookie 配置", test_cookie()))
        results.append(("视频 ID 提取", test_video_id_extraction()))
        results.append(("API 请求", test_api_request(video_url)))
        results.append(("视频下载", test_download(video_url)))
        
        # 显示总结
        print("\n" + "="*60)
        print("📊 测试总结")
        print("="*60)
        
        for name, success in results:
            status = "✅" if success else "❌"
            print(f"{status} {name}")
        
        all_success = all(success for _, success in results)
        sys.exit(0 if all_success else 1)
        
    else:
        print(f"❌ 未知命令: {command}")
        print("使用 'python test_douyin_downloader.py help' 查看帮助")
        sys.exit(1)


if __name__ == '__main__':
    main()
