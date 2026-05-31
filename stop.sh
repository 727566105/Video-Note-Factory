#!/bin/bash

echo "正在停止 VideoNote 项目相关服务..."

# 停止 Docker 容器
echo "1. 停止 Docker 容器..."
docker rm -f videonote 2>/dev/null
docker compose -f docker-compose.dev.yml down 2>/dev/null
docker compose -f docker-compose.yml down 2>/dev/null

# 停止前端开发服务器 (端口 3015)
echo "2. 停止前端开发服务器..."
pkill -f "vite.*3015" 2>/dev/null
pkill -f "node.*videoNote_frontend.*vite" 2>/dev/null

# 停止后端服务 (端口 8483/8484)
echo "3. 停止后端服务..."
pkill -f "python.*main.py.*8483" 2>/dev/null
pkill -f "python.*main.py.*8484" 2>/dev/null
pkill -f "uvicorn.*app.main:app" 2>/dev/null

# 清理端口占用
echo "4. 清理端口占用..."
for port in 3015 3016 8483 8484; do
    pid=$(lsof -t -i :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "  - 停止端口 $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

echo "完成！所有 VideoNote 相关服务已停止。"