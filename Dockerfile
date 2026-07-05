# === 阶段1：前端构建 ===
FROM node:22 AS frontend-builder

# 可配置镜像源
ARG NPM_REGISTRY=https://registry.npmjs.org

# 固定 pnpm 主版本：与 pnpm-lock.yaml 生成版本对齐，
# 避免 pnpm 11.x 在无 TTY 环境下重建 node_modules 触发 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
# env -u 清除注入的代理（内网代理对 npm registry 不通）
RUN env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    npm install -g pnpm@10

WORKDIR /app/frontend
COPY ./videoNote_frontend/package.json ./videoNote_frontend/pnpm-workspace.yaml ./videoNote_frontend/pnpm-lock.yaml ./
# CI=true：禁止 pnpm 交互式询问（无 TTY 时会 abort），双保险
ENV CI=true
# 清除注入的代理（内网代理对 npm registry 不通）
RUN env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    pnpm config set registry ${NPM_REGISTRY} && \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    pnpm install --frozen-lockfile
COPY ./videoNote_frontend .
ENV VITE_API_BASE_URL=/api
ENV VITE_SCREENSHOT_BASE_URL=/static/screenshots
# pipefail：让管道返回真实退出码（而非 tee 的 0），避免 build 失败被静默吞掉
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN pnpm run build 2>&1 | tee /tmp/build.log; \
    exit_code=$?; \
    if [ $exit_code -ne 0 ]; then \
      echo "=== BUILD FAILED, showing first 100 lines ==="; \
      head -100 /tmp/build.log; \
      exit $exit_code; \
    fi
SHELL ["/bin/sh", "-c"]

# === 阶段2：后端构建 ===
FROM python:3.11-slim AS backend-builder

# 可配置镜像源
ARG PIP_INDEX_URL=https://pypi.org/simple

# 清除可能从 Docker daemon 注入的代理（内网代理对外网源不通）
# 注意：ENV 设空值对 apt 无效，必须在 RUN 里用 env -u 实际清除
RUN env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    apt-get update && \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY ./backend/requirements.txt .
# 安装依赖（env -u 清除注入的代理，内网代理对 pypi 不通）
# 安装后清理：hf_xet(214M 可选加速后端,modelscope 用自有下载通道)、
# __pycache__、.pyc、pip 本身（运行时不需要）
# 注意：用 set -e 保证任一步失败立即终止，不用 && true 吞错误
RUN set -e; \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt; \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    pip install --no-cache-dir -i ${PIP_INDEX_URL} bcrypt==4.0.1; \
    pip uninstall -y hf-xet 2>/dev/null || true; \
    find /usr/local/lib/python3.11 -depth -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true; \
    find /usr/local/lib/python3.11 -name "*.pyc" -delete 2>/dev/null || true; \
    rm -rf /root/.cache /usr/local/lib/python3.11/site-packages/pip

# 模型不再预置进镜像，改为运行时按需下载到 /app/data/models/（data 为持久化卷）

# === 阶段3：最终镜像 ===
FROM python:3.11-slim

# 清除注入的代理（内网代理对外网源不通）
RUN env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    apt-get update && \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    apt-get install -y --no-install-recommends ffmpeg curl nginx supervisor gettext-base && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin
COPY ./backend /app/backend

COPY --from=frontend-builder /app/frontend/dist /var/www/html

COPY ./deploy/nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

COPY ./deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY ./deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN mkdir -p /app/data /app/backend/config /app/note_results /app/static/screenshots /app/uploads/icons /app/logs

ENV BACKEND_HOST=0.0.0.0
ENV ENV=production
ENV STATIC=/static
ENV OUT_DIR=./static/screenshots
ENV NOTE_OUTPUT_DIR=note_results
ENV IMAGE_BASE_URL=/static/screenshots
ENV DATA_DIR=data
ENV TRANSCRIBER_TYPE=fast-whisper
ENV WHISPER_MODEL_SIZE=base
ENV DATABASE_URL=sqlite:////app/data/video_note.db
ENV HF_ENDPOINT=https://hf-mirror.com
ENV WEBDAV_ENCRYPTION_KEY=

EXPOSE 80 8483

CMD ["/app/start.sh"]