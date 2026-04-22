#!/bin/bash
# BiliNote NAS 部署脚本

# 创建数据目录
mkdir -p data/db data/note_results data/static/screenshots data/static/covers data/downloads data/models

# 创建数据库文件（如不存在）
touch data/db/bili_note.db

# 复制环境配置
if [ ! -f .env ]; then
    cp .env.nas .env
    echo "已创建 .env 文件，请修改 WEBDAV_ENCRYPTION_KEY"
fi

# 构建并启动
docker compose -f docker-compose.nas.yml up -d --build

echo "部署完成，访问 http://localhost:3015"
