#!/bin/bash
# VideoNote 服务关闭脚本
# 同时处理 Docker 容器和本地直接启动的服务
# 用法: ./stop.sh

set -e

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 从 .env 读取端口配置，如果不存在则使用默认值
if [ -f "$SCRIPT_DIR/.env" ]; then
    BACKEND_PORT=$(grep -E "^BACKEND_PORT=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 || echo "")
    FRONTEND_PORT=$(grep -E "^FRONTEND_PORT=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 || echo "")
    APP_PORT=$(grep -E "^APP_PORT=" "$SCRIPT_DIR/.env" | cut -d'=' -f2 || echo "")
fi
BACKEND_PORT=${BACKEND_PORT:-8483}
FRONTEND_PORT=${FRONTEND_PORT:-${APP_PORT:-3015}}

echo "=========================================="
echo "  VideoNote 服务关闭脚本"
echo "=========================================="
echo ""

cd "$SCRIPT_DIR"
echo "[INFO] 工作目录: $SCRIPT_DIR"

# 1. 停止 Docker 容器
echo ""
echo "=========================================="
echo "  停止 Docker 容器"
echo "=========================================="
docker rm -f videonote 2>/dev/null && echo "[OK] Docker 容器 videonote 已删除" || echo "[INFO] 无 Docker 容器 videonote 运行"
docker compose -f docker-compose.dev.yml down 2>/dev/null && echo "[OK] docker-compose.dev.yml 已关闭" || true
docker compose -f docker-compose.yml down 2>/dev/null && echo "[OK] docker-compose.yml 已关闭" || true

# 2. 关闭本地启动的服务（按端口查找进程，优雅终止）
echo ""
echo "=========================================="
echo "  关闭本地服务"
echo "=========================================="

stop_port_process() {
    local port=$1
    local service_name=$2

    echo "[INFO] 检查端口 $port ($service_name)..."
    local pid=$(lsof -ti:$port 2>/dev/null || true)

    if [ -n "$pid" ]; then
        echo "[INFO] 发现进程 PID: $pid，正在关闭..."
        kill $pid 2>/dev/null || true
        sleep 2

        pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            echo "[WARN] 进程未响应，强制终止..."
            kill -9 $pid 2>/dev/null || true
            sleep 1
        fi

        pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            echo "[ERROR] 无法关闭进程 $pid，请手动处理: kill -9 $pid"
            return 1
        else
            echo "[OK] $service_name 服务已关闭"
        fi
    else
        echo "[OK] 端口 $port 未被占用，$service_name 服务未运行"
    fi
}

stop_port_process $BACKEND_PORT "后端"
stop_port_process $FRONTEND_PORT "前端"

# 额外清理其他可能的前端端口（兼容不同配置）
for port in 3015 3016; do
    if [ "$port" != "$FRONTEND_PORT" ] && [ "$port" != "$BACKEND_PORT" ]; then
        pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            echo "[INFO] 清理额外端口 $port (PID: $pid)"
            kill -9 $pid 2>/dev/null || true
        fi
    fi
done

# 额外清理可能残留的进程
echo ""
echo "[INFO] 清理残留进程..."
pkill -f "vite.*3015" 2>/dev/null || true
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "uvicorn.*app.main:app" 2>/dev/null || true

# 完成
echo ""
echo "=========================================="
echo "  服务已全部关闭"
echo "=========================================="
echo ""
echo "  重新启动服务: ./restart.sh"
echo ""
