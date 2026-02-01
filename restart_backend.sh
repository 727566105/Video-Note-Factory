#!/bin/bash
# 一键重启后端服务

echo "🔄 重启后端服务..."
echo ""

# 查找后端进程
BACKEND_PID=$(ps aux | grep "python.*main.py" | grep -v grep | awk '{print $2}')

if [ -z "$BACKEND_PID" ]; then
    echo "⚠️  后端服务未运行"
    echo ""
    echo "启动后端服务..."
    cd backend
    python main.py &
    echo "✅ 后端服务已启动"
else
    echo "📍 找到后端进程: PID $BACKEND_PID"
    echo ""
    
    # 停止服务
    echo "🛑 停止后端服务..."
    kill $BACKEND_PID
    
    # 等待进程结束
    sleep 2
    
    # 检查是否已停止
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "⚠️  进程未停止，强制终止..."
        kill -9 $BACKEND_PID
        sleep 1
    fi
    
    echo "✅ 后端服务已停止"
    echo ""
    
    # 重新启动
    echo "🚀 启动后端服务..."
    cd backend
    python main.py &
    NEW_PID=$!
    
    sleep 2
    
    # 验证启动
    if ps -p $NEW_PID > /dev/null 2>&1; then
        echo "✅ 后端服务已启动 (PID: $NEW_PID)"
        echo ""
        echo "📋 查看日志:"
        echo "   tail -f backend/logs/app.log"
        echo ""
        echo "🎉 重启完成！现在可以测试抖音下载功能了"
    else
        echo "❌ 后端服务启动失败"
        echo ""
        echo "请手动启动:"
        echo "   cd backend && python main.py"
    fi
fi
