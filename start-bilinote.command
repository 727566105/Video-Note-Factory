#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 启动 BiliNote 服务..."
echo ""

# 启动后端
echo "📦 启动后端服务 (端口 8483)..."
cd backend
python3 main.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端服务 (端口 3015)..."
cd BillNote_frontend
pnpm dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"
cd ..

echo ""
echo "✅ 服务启动完成！"
echo ""
echo "   前端地址: http://localhost:3015/"
echo "   后端地址: http://localhost:8483/"
echo ""
echo "按 Ctrl+C 停止所有服务，或直接关闭终端窗口"

# 保存 PID 到文件，方便后续停止
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid; echo ''; echo '🛑 所有服务已停止'; exit 0" INT TERM

# 保持脚本运行
wait
