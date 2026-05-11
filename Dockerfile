# === 阶段1：前端构建 ===
FROM node:22 AS frontend-builder

RUN npm install -g pnpm

WORKDIR /app/frontend
COPY ./videoNote_frontend/package.json ./videoNote_frontend/pnpm-workspace.yaml ./
RUN pnpm install
COPY ./videoNote_frontend .
ENV VITE_API_BASE_URL=
ENV VITE_SCREENSHOT_BASE_URL=/static/screenshots
RUN pnpm run build 2>&1 | tee /tmp/build.log; \
    exit_code=$?; \
    if [ $exit_code -ne 0 ]; then \
      echo "=== BUILD FAILED, showing first 100 lines ==="; \
      head -100 /tmp/build.log; \
      exit $exit_code; \
    fi

# === 阶段2：后端构建 ===
FROM python:3.11-slim AS backend-builder

RUN apt-get update && \
    apt-get install -y ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY ./backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN pip install --no-cache-dir bcrypt==4.0.1

RUN mkdir -p /app/backend/models/whisper && \
    python -c "from faster_whisper import WhisperModel; WhisperModel('base', download_root='/app/backend/models/whisper', device='cpu', compute_type='int8')"

# === 阶段3：最终镜像 ===
FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y ffmpeg curl nginx supervisor && \
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

RUN mkdir -p /app/data /app/note_results /app/static/screenshots /app/uploads/icons /app/logs

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
ENV DATABASE_URL=sqlite:////app/data/video_note.db
ENV HF_ENDPOINT=https://hf-mirror.com
ENV WEBDAV_ENCRYPTION_KEY=

EXPOSE 80 8483

CMD ["/app/start.sh"]