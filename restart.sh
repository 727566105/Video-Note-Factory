#!/bin/bash
# VideoNote 服务重启脚本
# 用法: ./restart.sh

set -e

# 获取脚本所在目录（项目根目录），避免写死本地路径
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8483
FRONTEND_PORT=3015

echo "=========================================="
echo "  VideoNote 服务重启脚本"
echo "=========================================="
echo ""

# 进入项目目录
cd "$PROJECT_ROOT"
echo "[INFO] 工作目录: $PROJECT_ROOT"

# 函数：检查端口是否被占用并终止进程
kill_port_process() {
    local port=$1
    local service_name=$2

    echo "[INFO] 检查端口 $port ($service_name)..."
    local pid=$(lsof -ti:$port 2>/dev/null || true)

    if [ -n "$pid" ]; then
        echo "[WARN] 端口 $port 已被占用，PID: $pid"
        echo "[INFO] 正在终止进程..."
        kill -9 $pid 2>/dev/null || true
        sleep 1

        # 再次检查
        pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            echo "[ERROR] 无法终止进程 $pid，请手动处理"
            return 1
        fi
        echo "[OK] 端口 $port 已释放"
    else
        echo "[OK] 端口 $port 未被占用"
    fi
}

# 函数：启动后端服务
start_backend() {
    echo ""
    echo "=========================================="
    echo "  启动后端服务 (端口 $BACKEND_PORT)"
    echo "=========================================="

    # 检查虚拟环境
    if [ ! -f "$PROJECT_ROOT/.venv/bin/python" ]; then
        echo "[ERROR] 虚拟环境不存在，请先创建: python3.12 -m venv .venv"
        return 1
    fi

    # 检查 .env 文件
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        echo "[ERROR] .env 文件不存在，请先创建: cp .env.example .env"
        return 1
    fi

    # 检查数据库
    if [ ! -f "$PROJECT_ROOT/data/video_note.db" ]; then
        echo "[WARN] 数据库不存在，将在启动时自动创建"
    fi

    echo "[INFO] 启动后端服务..."
    cd "$PROJECT_ROOT/backend"
    nohup "$PROJECT_ROOT/.venv/bin/python" main.py > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    cd "$PROJECT_ROOT"

    echo "[INFO] 后端进程 PID: $BACKEND_PID"
    echo "[INFO] 日志文件: $PROJECT_ROOT/logs/backend.log"

    # 等待服务启动
    echo "[INFO] 等待后端服务启动..."
    sleep 3

    # 检查进程是否还在运行
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "[ERROR] 后端服务启动失败，请查看日志:"
        echo "        cat $PROJECT_ROOT/logs/backend.log"
        return 1
    fi

    # 检查端口是否监听
    if lsof -i:$BACKEND_PORT > /dev/null 2>&1; then
        echo "[OK] 后端服务已启动，端口 $BACKEND_PORT 正在监听"
    else
        echo "[WARN] 后端进程运行中，但端口尚未监听，可能正在初始化..."
    fi
}

# 函数：启动前端服务
start_frontend() {
    echo ""
    echo "=========================================="
    echo "  启动前端服务 (端口 $FRONTEND_PORT)"
    echo "=========================================="

    # 检查 node_modules
    if [ ! -d "$PROJECT_ROOT/videoNote_frontend/node_modules" ]; then
        echo "[ERROR] node_modules 不存在，请先安装依赖: cd videoNote_frontend && pnpm install"
        return 1
    fi

    echo "[INFO] 启动前端服务..."
    cd "$PROJECT_ROOT/videoNote_frontend"
    nohup pnpm dev > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    cd "$PROJECT_ROOT"

    echo "[INFO] 前端进程 PID: $FRONTEND_PID"
    echo "[INFO] 日志文件: $PROJECT_ROOT/logs/frontend.log"

    # 等待服务启动
    echo "[INFO] 等待前端服务启动..."
    sleep 3

    # 检查进程是否还在运行
    if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "[ERROR] 前端服务启动失败，请查看日志:"
        echo "        cat $PROJECT_ROOT/logs/frontend.log"
        return 1
    fi

    # 检查端口是否监听
    if lsof -i:$FRONTEND_PORT > /dev/null 2>&1; then
        echo "[OK] 前端服务已启动，端口 $FRONTEND_PORT 正在监听"
    else
        echo "[WARN] 前端进程运行中，但端口尚未监听，可能正在初始化..."
    fi
}

# 创建日志目录
mkdir -p "$PROJECT_ROOT/logs"

# 第一步：关闭现有服务
echo ""
echo "=========================================="
echo "  关闭现有服务"
echo "=========================================="

kill_port_process $BACKEND_PORT "后端"
kill_port_process $FRONTEND_PORT "前端"

# 第二步：启动服务
start_backend
start_frontend

# 完成
echo ""
echo "=========================================="
echo "  服务重启完成"
echo "=========================================="
echo ""
echo "  前端地址: http://localhost:$FRONTEND_PORT"
echo "  后端地址: http://localhost:$BACKEND_PORT"
echo ""
echo "  查看日志:"
echo "    后端: tail -f $PROJECT_ROOT/logs/backend.log"
echo "    前端: tail -f $PROJECT_ROOT/logs/frontend.log"
echo ""
echo "  关闭服务: ./stop.sh"
echo ""