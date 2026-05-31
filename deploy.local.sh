#!/bin/bash

set -e

echo "=========================================="
echo "  VideoNote 本地编译部署脚本"
echo "=========================================="

# 配置
COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env.local"
PIP_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple"
NPM_REGISTRY="https://registry.npmmirror.com"

# 步骤1: 停止现有服务
echo ""
echo "[1/4] 停止现有服务..."
docker rm -f videonote 2>/dev/null || true
docker compose -f $COMPOSE_FILE down 2>/dev/null || true

# 清理端口占用
for port in 3015 3016 8483 8484; do
    pid=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "  清理端口 $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
    fi
done

# 步骤2: 构建镜像
echo ""
echo "[2/4] 构建 Docker 镜像 (使用国内镜像源)..."
docker compose -f $COMPOSE_FILE --env-file $ENV_FILE build \
    --build-arg PIP_INDEX_URL=$PIP_INDEX_URL \
    --build-arg NPM_REGISTRY=$NPM_REGISTRY

# 步骤3: 启动容器
echo ""
echo "[3/4] 启动容器..."
docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d

# 步骤4: 检查状态
echo ""
echo "[4/4] 检查服务状态..."
sleep 5

# 获取端口
APP_PORT=$(grep -E "^APP_PORT=" $ENV_FILE 2>/dev/null | cut -d'=' -f2 || echo "3016")
echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "访问地址: http://localhost:$APP_PORT"
echo ""
echo "容器状态:"
docker ps --filter "name=videonote" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "健康检查:"
curl -s http://localhost:$APP_PORT/api/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:$APP_PORT/api/health
echo ""
echo "查看日志: docker logs videonote -f"
echo "停止服务: ./stop.sh"
echo ""