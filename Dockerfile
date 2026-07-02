# === 阶段1：前端构建 ===
FROM node:22 AS frontend-builder

# 可配置镜像源
ARG NPM_REGISTRY=https://registry.npmjs.org

# 固定 pnpm 主版本：与 pnpm-lock.yaml 生成版本对齐，
# 避免 pnpm 11.x 在无 TTY 环境下重建 node_modules 触发 ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
RUN npm install -g pnpm@10

WORKDIR /app/frontend
COPY ./videoNote_frontend/package.json ./videoNote_frontend/pnpm-workspace.yaml ./videoNote_frontend/pnpm-lock.yaml ./
# CI=true：禁止 pnpm 交互式询问（无 TTY 时会 abort），双保险
ENV CI=true
RUN pnpm config set registry ${NPM_REGISTRY} && pnpm install --frozen-lockfile
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

# 换清华 debian 源 + 清除可能坏掉的代理（构建机代理对 debian 源 502）
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list.d/debian.sources 2>/dev/null \
    || sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list 2>/dev/null \
    || true

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt

RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} bcrypt==4.0.1

RUN mkdir -p /app/backend/models/whisper

# === 阶段3：最终镜像 ===
FROM python:3.11-slim

# 换清华 debian 源
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list.d/debian.sources 2>/dev/null \
    || sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' \
        /etc/apt/sources.list 2>/dev/null \
    || true

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl nginx supervisor gettext-base && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin
COPY ./backend /app/backend

COPY --from=backend-builder /app/backend/models /app/backend/models

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