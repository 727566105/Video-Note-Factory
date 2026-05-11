#!/bin/bash

# 本地编译镜像并部署脚本
# 功能：清理缓存、构建镜像、部署服务、显示部署信息
# 使用方法：
#   ./deploy-local.sh              # 默认：清理 + 构建 + 部署
#   ./deploy-local.sh --clean-only # 仅清理缓存和未使用镜像
#   ./deploy-local.sh --build-only # 仅构建镜像
#   ./deploy-local.sh --no-clean  # 不清理，直接构建部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# 默认配置
IMAGE_NAME="videonote-local"
CONTAINER_NAME="videonote-local"
APP_PORT=${APP_PORT:-3015}
BUILD_MODE="full"
CLEAN_MODE="true"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-only)
            BUILD_MODE="none"
            CLEAN_MODE="true"
            shift
            ;;
        --build-only)
            BUILD_MODE="build"
            CLEAN_MODE="false"
            shift
            ;;
        --no-clean)
            CLEAN_MODE="false"
            shift
            ;;
        --port)
            APP_PORT=$2
            shift 2
            ;;
        --help)
            echo "使用方法:"
            echo "  $0                    # 默认：清理 + 构建 + 部署"
            echo "  $0 --clean-only       # 仅清理缓存和未使用镜像"
            echo "  $0 --build-only       # 仅构建镜像"
            echo "  $0 --no-clean         # 不清理，直接构建部署"
            echo "  $0 --port <端口>      # 指定部署端口（默认 3015）"
            exit 0
            ;;
        *)
            print_error "未知参数: $1"
            exit 1
            ;;
    esac
done

# 检查 .env 文件
if [ ! -f ".env" ]; then
    print_warning ".env 文件不存在，正在从 .env.example 复制..."
    cp .env.example .env
    print_success ".env 文件已创建"
fi

# 加载环境变量
set -a
source .env
set +a

# 停止占用指定端口的所有容器
stop_containers_by_port() {
    local port=$1
    print_info "检查端口 ${port} 是否被占用..."
    
    # 查找占用该端口的容器
    containers=$(docker ps --format '{{.Names}} {{.Ports}}' | grep ":${port}->" | awk '{print $1}')
    
    if [ -n "$containers" ]; then
        print_warning "发现以下容器占用端口 ${port}:"
        echo "$containers"
        
        for container in $containers; do
            print_info "停止容器: ${container}"
            docker stop ${container} 2>/dev/null || true
            docker rm ${container} 2>/dev/null || true
        done
        print_success "已停止并删除占用端口 ${port} 的容器"
    else
        print_info "端口 ${port} 未被任何容器占用"
    fi
}

# ==================== 清理阶段 ====================
if [ "$CLEAN_MODE" = "true" ]; then
    print_info "开始清理缓存和未使用镜像..."
    
    # 1. 停止并删除旧容器
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_info "停止并删除旧容器 ${CONTAINER_NAME}..."
        docker stop ${CONTAINER_NAME} 2>/dev/null || true
        docker rm ${CONTAINER_NAME} 2>/dev/null || true
        print_success "旧容器已删除"
    else
        print_info "没有找到旧容器 ${CONTAINER_NAME}"
    fi
    
    # 2. 删除旧镜像
    if docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}:"; then
        print_info "删除旧镜像 ${IMAGE_NAME}..."
        docker rmi -f $(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${IMAGE_NAME}:" | head -1) 2>/dev/null || true
        print_success "旧镜像已删除"
    fi
    
    # 3. 清理 Docker 构建缓存
    print_info "清理 Docker 构建缓存..."
    docker builder prune -f 2>/dev/null || true
    print_success "构建缓存已清理"
    
    # 4. 清理悬空镜像（dangling images）
    print_info "清理悬空镜像..."
    dangling_count=$(docker images -f "dangling=true" -q | wc -l)
    if [ "$dangling_count" -gt 0 ]; then
        docker image prune -f 2>/dev/null || true
        print_success "已清理 ${dangling_count} 个悬空镜像"
    else
        print_info "没有悬空镜像需要清理"
    fi
    
    # 5. 清理未使用的镜像（未被任何容器使用的镜像）
    print_info "清理未使用的镜像..."
    unused_images=$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E "node:|python:|nginx:|alpine:" | while read img id; do
        if ! docker ps -a --format '{{.Image}}' | grep -q "$id"; then
            echo "$id"
        fi
    done)
    
    if [ -n "$unused_images" ]; then
        unused_count=$(echo "$unused_images" | wc -l)
        print_warning "发现 ${unused_count} 个未使用的基础镜像，是否清理？(y/n)"
        read -t 5 -n 1 answer || answer="n"
        if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
            echo "$unused_images" | xargs docker rmi -f 2>/dev/null || true
            print_success "未使用的基础镜像已清理"
        else
            print_info "跳过清理未使用的基础镜像"
        fi
    else
        print_info "没有未使用的基础镜像"
    fi
    
    # 6. 显示清理后的磁盘使用情况
    print_info "Docker 磁盘使用情况:"
    docker system df
    
    print_success "清理完成！"
fi

# 如果只是清理模式，直接退出
if [ "$BUILD_MODE" = "none" ]; then
    exit 0
fi

# ==================== 构建阶段 ====================
print_info "开始构建镜像 ${IMAGE_NAME}..."

# 构建镜像
docker build \
    -t ${IMAGE_NAME}:latest \
    -f Dockerfile \
    --build-arg VITE_API_BASE_URL=/api \
    --build-arg VITE_SCREENSHOT_BASE_URL=/static/screenshots \
    --no-cache \
    .

if [ $? -ne 0 ]; then
    print_error "镜像构建失败！"
    exit 1
fi

print_success "镜像构建完成！"

# 显示镜像信息
print_info "镜像信息:"
docker images ${IMAGE_NAME}:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# ==================== 部署阶段 ====================
if [ "$BUILD_MODE" = "full" ]; then
    print_info "开始部署服务..."
    
    # 停止占用端口的所有容器
    stop_containers_by_port ${APP_PORT}
    
    # 创建必要的目录
    mkdir -p data note_results static/screenshots uploads/icons logs
    
    # 启动容器
    docker run -d \
        --name ${CONTAINER_NAME} \
        --restart always \
        -p ${APP_PORT}:80 \
        -v ./data:/app/data \
        -v ./note_results:/app/note_results \
        -v ./static:/app/static \
        -v ./uploads:/app/uploads \
        -v ./logs:/app/logs \
        -e BACKEND_PORT=8483 \
        -e BACKEND_HOST=0.0.0.0 \
        -e ENV=production \
        -e TZ=Asia/Shanghai \
        -e STATIC=/static \
        -e OUT_DIR=./static/screenshots \
        -e NOTE_OUTPUT_DIR=note_results \
        -e IMAGE_BASE_URL=/static/screenshots \
        -e DATA_DIR=data \
        -e TRANSCRIBER_TYPE=${TRANSCRIBER_TYPE:-fast-whisper} \
        -e WHISPER_MODEL_SIZE=${WHISPER_MODEL_SIZE:-base} \
        -e HF_ENDPOINT=${HF_ENDPOINT:-https://hf-mirror.com} \
        -e WEBDAV_ENCRYPTION_KEY=${WEBDAV_ENCRYPTION_KEY:-} \
        -e JWT_SECRET_KEY=${JWT_SECRET_KEY:-} \
        -e DATABASE_URL=sqlite:////app/data/video_note.db \
        ${IMAGE_NAME}:latest
    
    if [ $? -ne 0 ]; then
        print_error "容器启动失败！"
        exit 1
    fi
    
    print_success "服务部署完成！"
    
    # 等待服务启动
    print_info "等待服务启动..."
    sleep 5
    
    # 检查服务状态
    print_info "服务状态:"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # 健康检查
    print_info "进行健康检查..."
    if curl -sf http://localhost:${APP_PORT} > /dev/null 2>&1; then
        print_success "服务健康检查通过！"
    else
        print_warning "服务可能还在启动中，请稍后访问"
    fi
    
    # 显示访问信息
    echo ""
    echo "=========================================="
    print_success "部署成功！"
    echo "=========================================="
    echo ""
    echo "访问地址: http://localhost:${APP_PORT}"
    echo "容器名称: ${CONTAINER_NAME}"
    echo ""
    echo "常用命令:"
    echo "  查看日志: docker logs -f ${CONTAINER_NAME}"
    echo "  停止服务: docker stop ${CONTAINER_NAME}"
    echo "  重启服务: docker restart ${CONTAINER_NAME}"
    echo "  删除服务: docker rm -f ${CONTAINER_NAME}"
    echo ""
fi

print_success "所有操作完成！"