# === 阶段1：前端构建 ===
FROM node:18-alpine AS frontend-builder

RUN npm install -g pnpm
RUN pnpm config set registry https://registry.npmmirror.com

WORKDIR /app/frontend
COPY ./videoNote_frontend/package.json ./videoNote_frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ./videoNote_frontend .
ENV VITE_API_BASE_URL=/api
ENV VITE_SCREENSHOT_BASE_URL=/static/screenshots
RUN pnpm run build

# === 阶段2：后端构建 ===
FROM python:3.11-slim AS backend-builder

RUN rm -f /etc/apt/sources.list && \
    rm -rf /etc/apt/sources.list.d/* && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/bin:${PATH}"
ENV HF_ENDPOINT=https://hf-mirror.com

WORKDIR /app/backend
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 降级 bcrypt 版本以兼容 passlib
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple bcrypt==4.0.1

# 下载 Whisper base 模型
RUN mkdir -p /app/models/whisper && \
    python -c "from faster_whisper import WhisperModel; WhisperModel('base', download_root='/app/models/whisper', device='cpu', compute_type='int8')"

# === 阶段3：最终镜像 ===
FROM python:3.11-slim

# 安装 nginx 和 supervisor
RUN rm -f /etc/apt/sources.list && \
    rm -rf /etc/apt/sources.list.d/* && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ffmpeg curl nginx supervisor && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/bin:${PATH}"
ENV HF_ENDPOINT=https://hf-mirror.com

WORKDIR /app

# 复制后端代码和依赖
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin
COPY ./backend /app/backend

# 复制 Python 解释器路径
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages

# 复制模型（从构建阶段）
COPY --from=backend-builder /app/models /app/models

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist /var/www/html

# 复制 nginx 配置
COPY ./deploy/nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# 复制 supervisor 配置
COPY ./deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 复制启动脚本
COPY ./deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 创建必要的目录
RUN mkdir -p /app/data /app/note_results /app/static/screenshots /app/uploads/icons /app/logs

# 设置环境变量
ENV BACKEND_PORT=8483
ENV BACKEND_HOST=0.0.0.0
ENV ENV=production
ENV STATIC=/static
ENV OUT_DIR=./static/screenshots
ENV NOTE_OUTPUT_DIR=note_results
ENV IMAGE_BASE_URL=/static/screenshots
ENV DATA_DIR=data
ENV TRANSCRIBER_TYPE=fast-whisper
ENV WHISPER_MODEL_SIZE=base
ENV DATABASE_URL=sqlite:///data/video_note.db

EXPOSE 80 8483

CMD ["/app/start.sh"]