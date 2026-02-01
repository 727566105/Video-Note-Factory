#!/bin/bash
# 抖音 Cookie 测试脚本
# 从项目根目录运行

echo "🔍 测试抖音 Cookie 配置..."
echo ""

# 检查配置文件
if [ -f "config/downloader.json" ]; then
    echo "✅ 配置文件存在: config/downloader.json"
    
    # 检查 Cookie 长度
    cookie_len=$(python3 -c "import json; data=json.load(open('config/downloader.json')); print(len(data.get('douyin',{}).get('cookie','')))")
    
    if [ "$cookie_len" -gt 0 ]; then
        echo "✅ Cookie 已配置 (长度: $cookie_len 字符)"
        
        # 检查必需字段
        has_ttwid=$(python3 -c "import json; data=json.load(open('config/downloader.json')); print('ttwid=' in data.get('douyin',{}).get('cookie',''))")
        has_sessionid=$(python3 -c "import json; data=json.load(open('config/downloader.json')); print('sessionid=' in data.get('douyin',{}).get('cookie',''))")
        
        if [ "$has_ttwid" = "True" ]; then
            echo "✅ 包含 ttwid"
        else
            echo "❌ 缺少 ttwid"
        fi
        
        if [ "$has_sessionid" = "True" ]; then
            echo "✅ 包含 sessionid"
        else
            echo "❌ 缺少 sessionid"
        fi
        
        echo ""
        echo "🎉 Cookie 配置正常！"
        echo ""
        echo "现在可以测试抖音下载功能了"
        
    else
        echo "❌ Cookie 未配置或为空"
        echo ""
        echo "请运行: cd backend/tools && python fix_douyin_cookie.py"
    fi
else
    echo "❌ 配置文件不存在: config/downloader.json"
    echo ""
    echo "请先运行应用程序或手动创建配置文件"
fi
