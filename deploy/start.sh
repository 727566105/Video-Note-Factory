#!/bin/bash

echo "Starting VideoNote..."

# 创建必要的目录
mkdir -p /app/data /app/note_results /app/static/screenshots /app/uploads/icons /app/logs

# 启动 supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf