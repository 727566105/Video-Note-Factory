#!/bin/bash

echo "Starting VideoNote..."

# 创建必要的目录
mkdir -p /app/data /app/backend/config /app/note_results /app/static/screenshots /app/uploads/icons /app/logs

# 复制预构建的 whisper 模型到 data 目录
echo "Checking whisper models..."
if [ -d "/app/backend/models/whisper" ]; then
    mkdir -p /app/data/models/whisper
    # 复制所有 whisper 模型（保留已存在的）
    cp -rn /app/backend/models/whisper/* /app/data/models/whisper/ 2>/dev/null || true
    echo "Whisper models copied to /app/data/models/whisper/"
fi

# 使用环境变量替换 nginx 配置中的端口
if [ -z "$BACKEND_PORT" ]; then
    BACKEND_PORT=8483
fi
echo "Backend port: $BACKEND_PORT"

# 替换 nginx 配置中的端口变量（使用 envsubst 或手动替换）
if command -v envsubst >/dev/null 2>&1; then
    envsubst '${BACKEND_PORT}' < /etc/nginx/sites-available/default > /tmp/nginx.conf
    mv /tmp/nginx.conf /etc/nginx/sites-available/default
else
    # 没有 envsubst，使用 sed 手动替换
    sed -i "s/\${BACKEND_PORT}/$BACKEND_PORT/g" /etc/nginx/sites-available/default
fi

# 验证 nginx 配置是否有效
if [ ! -s /etc/nginx/sites-available/default ]; then
    echo "ERROR: nginx config is empty, regenerating..."
    cat > /etc/nginx/sites-available/default <<'NGINX_CONF'
server {
    listen 80;
    server_name localhost;

    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /static {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_CONF
    sed -i "s/BACKEND_PORT_PLACEHOLDER/$BACKEND_PORT/g" /etc/nginx/sites-available/default
fi

# 启动 supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf