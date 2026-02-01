#!/usr/bin/env python3
"""
同步配置文件工具

确保 config/downloader.json 和 backend/config/downloader.json 保持同步
"""

import json
import sys
from pathlib import Path

def find_project_root():
    """查找项目根目录"""
    current = Path(__file__).resolve().parent
    # 从 backend/tools 向上找到包含 .git 或 README.md 的目录
    while current != current.parent:
        # 检查是否是项目根目录的标志
        if (current / '.git').exists():
            return current
        if (current / 'README.md').exists() and (current / 'backend').exists():
            return current
        current = current.parent
    # 如果找不到，假设在 backend/tools，返回上两级
    return Path(__file__).resolve().parent.parent.parent

def main():
    print("🔄 同步配置文件...")
    
    # 使用相对于脚本的路径
    script_dir = Path(__file__).resolve().parent
    root = script_dir.parent.parent  # backend/tools -> backend -> root
    
    print(f"📁 项目根目录: {root}")
    
    # 两个配置文件位置
    root_config = root / "config" / "downloader.json"
    backend_config = root / "backend" / "config" / "downloader.json"
    
    print(f"\n检查配置文件:")
    print(f"  根目录: {root_config}")
    print(f"    存在: {'✅' if root_config.exists() else '❌'}")
    print(f"  Backend: {backend_config}")
    print(f"    存在: {'✅' if backend_config.exists() else '❌'}")
    
    # 确定源文件（使用最新的）
    source = None
    if backend_config.exists() and root_config.exists():
        backend_mtime = backend_config.stat().st_mtime
        root_mtime = root_config.stat().st_mtime
        source = backend_config if backend_mtime > root_mtime else root_config
        print(f"\n📋 使用最新的配置: {source.name}")
    elif backend_config.exists():
        source = backend_config
        print(f"\n📋 使用 backend 配置")
    elif root_config.exists():
        source = root_config
        print(f"\n📋 使用根目录配置")
    else:
        print("\n❌ 没有找到配置文件")
        sys.exit(1)
    
    # 读取源配置
    try:
        with open(source, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"✅ 读取配置成功")
        
        # 检查 douyin cookie
        if 'douyin' in config and config['douyin'].get('cookie'):
            cookie_len = len(config['douyin']['cookie'])
            print(f"   抖音 Cookie 长度: {cookie_len} 字符")
        else:
            print(f"   ⚠️  抖音 Cookie 未配置")
    except Exception as e:
        print(f"❌ 读取配置失败: {e}")
        sys.exit(1)
    
    # 同步到两个位置
    targets = [root_config, backend_config]
    
    for target in targets:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(target, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print(f"✅ 已同步到: {target}")
        except Exception as e:
            print(f"❌ 同步失败 {target}: {e}")
    
    print("\n🎉 配置文件同步完成！")

if __name__ == '__main__':
    main()
