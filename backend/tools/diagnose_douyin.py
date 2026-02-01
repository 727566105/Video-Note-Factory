#!/usr/bin/env python3
"""
抖音下载器综合诊断工具

一键运行所有诊断测试，快速定位问题
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# 添加父目录到路径以便导入模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cookie_manager import CookieConfigManager
from app.downloaders.douyin_downloader import DouyinDownloader


class DiagnosticReport:
    """诊断报告"""
    
    def __init__(self):
        self.tests = []
        self.start_time = datetime.now()
    
    def add_test(self, name: str, passed: bool, message: str, details: dict = None):
        """添加测试结果"""
        self.tests.append({
            'name': name,
            'passed': passed,
            'message': message,
            'details': details or {}
        })
    
    def print_summary(self):
        """打印摘要"""
        print("\n" + "="*70)
        print("📊 诊断报告")
        print("="*70)
        
        passed_count = sum(1 for t in self.tests if t['passed'])
        total_count = len(self.tests)
        
        for test in self.tests:
            status = "✅" if test['passed'] else "❌"
            print(f"\n{status} {test['name']}")
            print(f"   {test['message']}")
            
            if test['details']:
                for key, value in test['details'].items():
                    print(f"   • {key}: {value}")
        
        print("\n" + "="*70)
        print(f"总计: {passed_count}/{total_count} 测试通过")
        
        if passed_count == total_count:
            print("🎉 所有测试通过！抖音下载器配置正常")
        else:
            print("⚠️  部分测试失败，请根据上述信息修复问题")
        
        print(f"诊断耗时: {(datetime.now() - self.start_time).total_seconds():.2f} 秒")
        print("="*70)
        
        return passed_count == total_count


def test_config_file(report: DiagnosticReport):
    """测试配置文件"""
    print("\n🔍 [1/6] 检查配置文件...")
    
    config_path = Path(__file__).parent.parent / "config" / "downloader.json"
    
    if not config_path.exists():
        report.add_test(
            "配置文件存在性",
            False,
            f"配置文件不存在: {config_path}",
            {"建议": "运行应用程序以自动创建配置文件"}
        )
        return False
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        report.add_test(
            "配置文件格式",
            True,
            "配置文件格式正确",
            {"路径": str(config_path), "大小": f"{config_path.stat().st_size} 字节"}
        )
        return True
    except Exception as e:
        report.add_test(
            "配置文件格式",
            False,
            f"配置文件格式错误: {e}",
            {"建议": "检查 JSON 格式是否正确"}
        )
        return False


def test_cookie_exists(report: DiagnosticReport):
    """测试 Cookie 是否存在"""
    print("🔍 [2/6] 检查 Cookie 配置...")
    
    cfm = CookieConfigManager()
    
    if not cfm.exists('douyin'):
        report.add_test(
            "Cookie 配置",
            False,
            "抖音 Cookie 未配置",
            {
                "建议": "运行 python cookie_converter.py update douyin <cookie_file>",
                "文档": "查看 README_DOUYIN_COOKIE.md"
            }
        )
        return False
    
    cookie = cfm.get('douyin')
    
    if not cookie or not cookie.strip():
        report.add_test(
            "Cookie 配置",
            False,
            "抖音 Cookie 为空",
            {"建议": "重新配置 Cookie"}
        )
        return False
    
    report.add_test(
        "Cookie 配置",
        True,
        "Cookie 已配置",
        {
            "长度": f"{len(cookie)} 字符",
            "字段数": f"{len(cookie.split(';'))} 个"
        }
    )
    return True


def test_cookie_format(report: DiagnosticReport):
    """测试 Cookie 格式"""
    print("🔍 [3/6] 检查 Cookie 格式...")
    
    cfm = CookieConfigManager()
    cookie = cfm.get('douyin', auto_convert=False)
    
    if not cookie:
        report.add_test(
            "Cookie 格式",
            False,
            "无法检查格式（Cookie 不存在）",
            {}
        )
        return False
    
    # 检测格式
    is_netscape = '\t' in cookie or cookie.startswith('#')
    
    if is_netscape:
        report.add_test(
            "Cookie 格式",
            False,
            "Cookie 是 Netscape 格式，需要转换",
            {
                "当前格式": "Netscape (多行，tab 分隔)",
                "需要格式": "浏览器格式 (单行，分号分隔)",
                "修复命令": "python fix_douyin_cookie.py"
            }
        )
        return False
    
    report.add_test(
        "Cookie 格式",
        True,
        "Cookie 格式正确（浏览器格式）",
        {"格式": "name1=value1; name2=value2; ..."}
    )
    return True


def test_cookie_fields(report: DiagnosticReport):
    """测试 Cookie 必需字段"""
    print("🔍 [4/6] 检查 Cookie 必需字段...")
    
    cfm = CookieConfigManager()
    required_fields = ['ttwid', 'sessionid']
    
    is_valid, msg = cfm.validate_cookie('douyin', required_fields)
    
    if not is_valid:
        cookie = cfm.get('douyin')
        missing = []
        present = []
        
        if cookie:
            for field in required_fields:
                if f"{field}=" in cookie:
                    present.append(field)
                else:
                    missing.append(field)
        else:
            missing = required_fields
        
        report.add_test(
            "Cookie 必需字段",
            False,
            msg,
            {
                "缺失字段": ', '.join(missing) if missing else "无",
                "已有字段": ', '.join(present) if present else "无",
                "建议": "重新登录抖音并导出完整 Cookie"
            }
        )
        return False
    
    report.add_test(
        "Cookie 必需字段",
        True,
        "包含所有必需字段",
        {"必需字段": ', '.join(required_fields)}
    )
    return True


def test_video_id_extraction(report: DiagnosticReport):
    """测试视频 ID 提取"""
    print("🔍 [5/6] 测试视频 ID 提取...")
    
    try:
        downloader = DouyinDownloader()
        
        test_cases = [
            ("https://www.douyin.com/video/7345492945006595379", "7345492945006595379"),
            ("https://v.douyin.com/0pcFVdG_lx4/", None),  # 短链接需要重定向
        ]
        
        success_count = 0
        for url, expected_id in test_cases:
            video_id = downloader.extract_video_id(url)
            if video_id:
                success_count += 1
        
        if success_count > 0:
            report.add_test(
                "视频 ID 提取",
                True,
                f"成功提取 {success_count}/{len(test_cases)} 个测试用例",
                {"功能": "正常"}
            )
            return True
        else:
            report.add_test(
                "视频 ID 提取",
                False,
                "无法提取视频 ID",
                {"建议": "检查 URL 格式"}
            )
            return False
            
    except Exception as e:
        report.add_test(
            "视频 ID 提取",
            False,
            f"测试失败: {e}",
            {}
        )
        return False


def test_api_request(report: DiagnosticReport, video_url: str = None):
    """测试 API 请求"""
    print("🔍 [6/6] 测试 API 请求...")
    
    if not video_url:
        report.add_test(
            "API 请求",
            None,
            "跳过（未提供测试 URL）",
            {"说明": "使用 --test-url 参数提供视频 URL 进行测试"}
        )
        return None
    
    try:
        downloader = DouyinDownloader()
        
        print(f"   测试 URL: {video_url}")
        video_info = downloader.fetch_video_info(video_url)
        
        if 'aweme_detail' in video_info:
            detail = video_info['aweme_detail']
            report.add_test(
                "API 请求",
                True,
                "API 请求成功",
                {
                    "视频标题": detail.get('desc', 'N/A')[:50],
                    "作者": detail.get('author', {}).get('nickname', 'N/A'),
                    "点赞数": detail.get('statistics', {}).get('digg_count', 0)
                }
            )
            return True
        else:
            report.add_test(
                "API 请求",
                False,
                "API 返回数据不完整",
                {"响应": str(video_info)[:200]}
            )
            return False
            
    except Exception as e:
        error_msg = str(e)
        
        # 分析错误类型
        suggestions = []
        if "Cookie" in error_msg or "cookie" in error_msg:
            suggestions.append("运行: python fix_douyin_cookie.py")
        if "HTML" in error_msg:
            suggestions.append("Cookie 可能已失效，需要重新获取")
        if "超时" in error_msg or "timeout" in error_msg:
            suggestions.append("检查网络连接")
        
        report.add_test(
            "API 请求",
            False,
            f"API 请求失败: {error_msg[:200]}",
            {"建议": '; '.join(suggestions) if suggestions else "查看详细错误信息"}
        )
        return False


def main():
    """主函数"""
    print("="*70)
    print("🔧 抖音下载器综合诊断工具")
    print("="*70)
    print("\n正在运行诊断测试，请稍候...\n")
    
    # 解析命令行参数
    test_url = None
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--help', '-h']:
            print("""
用法:
  python diagnose_douyin.py [--test-url <video_url>]

选项:
  --test-url <url>    提供视频 URL 进行 API 请求测试
  --help, -h          显示此帮助信息

示例:
  # 基础诊断（不测试 API）
  python diagnose_douyin.py
  
  # 完整诊断（包括 API 测试）
  python diagnose_douyin.py --test-url "https://www.douyin.com/video/7345492945006595379"
""")
            sys.exit(0)
        elif sys.argv[1] == '--test-url' and len(sys.argv) > 2:
            test_url = sys.argv[2]
    
    report = DiagnosticReport()
    
    # 运行所有测试
    test_config_file(report)
    test_cookie_exists(report)
    test_cookie_format(report)
    test_cookie_fields(report)
    test_video_id_extraction(report)
    test_api_request(report, test_url)
    
    # 打印报告
    all_passed = report.print_summary()
    
    # 提供修复建议
    if not all_passed:
        print("\n💡 快速修复步骤:")
        print("   1. 运行自动修复: python fix_douyin_cookie.py")
        print("   2. 如果失败，重新获取 Cookie:")
        print("      - 访问 https://www.douyin.com 并登录")
        print("      - 使用浏览器插件导出 Cookie")
        print("      - 运行: python cookie_converter.py update douyin <cookie_file>")
        print("   3. 验证修复: python diagnose_douyin.py --test-url <video_url>")
        print("\n📚 详细文档: README_DOUYIN_COOKIE.md")
    
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
