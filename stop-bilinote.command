#!/bin/bash
cd "$(dirname "$0")"

echo "🛑 停止 BiliNote 服务..."

if [ -f .backend.pid ]; then
    kill $(cat .backend.pid) 2>/dev/null
    rm -f .backend.pid
    echo "   后端已停止"
fi

if [ -f .frontend.pid ]; then
    kill $(cat .frontend.pid) 2>/dev/null
    rm -f .frontend.pid
    echo "   前端已停止"
fi

# 清理可能残留的进程
pkill -f "python3.*main.py" 2>/dev/null
pkill -f "vite.*BiliNote" 2>/dev/null

echo "✅ 所有服务已停止"

sleep 1
