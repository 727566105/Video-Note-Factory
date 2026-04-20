#!/bin/bash
# BiliNote Docker 部署打包脚本
# 用于飞牛 NAS Docker 部署

set -e

echo "=========================================="
echo "  BiliNote Docker 部署打包脚本"
echo "=========================================="

# 包名
PACKAGE_NAME="bilinote-docker"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="${PACKAGE_NAME}_${TIMESTAMP}"

echo ""
echo "[1/5] 创建打包目录..."
mkdir -p "$OUTPUT_DIR"

echo "[2/5] 复制必要文件..."
# 复制 Docker 相关文件
cp docker-compose.yml "$OUTPUT_DIR/"
cp -r backend "$OUTPUT_DIR/"
cp -r BillNote_frontend "$OUTPUT_DIR/"
cp -r nginx "$OUTPUT_DIR/"

# 复制配置文件
cp .env.example "$OUTPUT_DIR/.env"

echo "[3/5] 清理不必要的文件..."
# 清理后端
rm -rf "$OUTPUT_DIR/backend/__pycache__"
rm -rf "$OUTPUT_DIR/backend/.idea"
rm -rf "$OUTPUT_DIR/backend/logs"
rm -rf "$OUTPUT_DIR/backend/data"
rm -rf "$OUTPUT_DIR/backend/note_results"
rm -rf "$OUTPUT_DIR/backend/models"
rm -rf "$OUTPUT_DIR/backend/uploads"
rm -f "$OUTPUT_DIR/backend/bili_note.db"

# 清理前端
rm -rf "$OUTPUT_DIR/BillNote_frontend/node_modules"
rm -rf "$OUTPUT_DIR/BillNote_frontend/dist"
rm -rf "$OUTPUT_DIR/BillNote_frontend/.idea"

echo "[4/5] 创建说明文件..."
cat > "$OUTPUT_DIR/README_DEPLOY.md" << 'EOF'
# BiliNote Docker 部署说明

## 部署步骤

### 1. 上传文件
将整个文件夹上传到飞牛 NAS

### 2. 配置环境变量
编辑 `.env` 文件，根据需要修改配置：

```bash
# 主要配置项
BACKEND_PORT=8483
APP_PORT=3015
TRANSCRIBER_TYPE=fast-whisper
WHISPER_MODEL_SIZE=base
```

### 3. 启动服务
```bash
docker-compose up -d --build
```

### 4. 访问应用
浏览器访问: http://你的NAS_IP:3015

## 数据持久化
建议在 docker-compose.yml 中添加数据卷挂载：

```yaml
volumes:
  - ./data:/app/data
  - ./note_results:/app/note_results
  - ./uploads:/app/uploads
```

## 常用命令
```bash
# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```
EOF

echo "[5/5] 打包压缩..."
tar -czvf "${OUTPUT_DIR}.tar.gz" "$OUTPUT_DIR"

# 清理临时目录
rm -rf "$OUTPUT_DIR"

echo ""
echo "=========================================="
echo "  打包完成！"
echo "=========================================="
echo ""
echo "打包文件: ${OUTPUT_DIR}.tar.gz"
echo "文件大小: $(du -h "${OUTPUT_DIR}.tar.gz" | cut -f1)"
echo ""
echo "上传步骤:"
echo "1. 将 ${OUTPUT_DIR}.tar.gz 上传到飞牛 NAS"
echo "2. 解压: tar -xzvf ${OUTPUT_DIR}.tar.gz"
echo "3. 进入目录配置 .env 文件"
echo "4. 运行: docker-compose up -d --build"
echo ""
