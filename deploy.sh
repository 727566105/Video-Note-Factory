#!/bin/bash

set -e

echo "=========================================="
echo "  VideoNote 生产环境部署脚本"
echo "=========================================="

# 配置
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# 步骤1: 停止现有服务
echo ""
echo "[1/5] 停止现有服务..."
docker rm -f videonote 2>/dev/null || true
docker compose -f $COMPOSE_FILE down 2>/dev/null || true

# 清理端口占用
APP_PORT=$(grep -E "^APP_PORT=" $ENV_FILE 2>/dev/null | cut -d'=' -f2 || echo "3016")
echo "目标端口: $APP_PORT"
for port in $APP_PORT 3015 3016 8483 8484; do
    pid=$(lsof -t -i:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "  清理端口 $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
    fi
done

# 步骤2: 拉取最新镜像
echo ""
echo "[2/5] 拉取最新 Docker 镜像..."
docker compose -f $COMPOSE_FILE pull

# 步骤3: 启动容器
echo ""
echo "[3/5] 启动容器..."
docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d

# 步骤4: 等待服务就绪
echo ""
echo "[4/5] 等待服务启动..."
sleep 10

# 步骤5: 检查状态
echo ""
echo "[5/5] 检查服务状态..."

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
echo "停止服务: docker compose -f docker-compose.yml down"
echo ""