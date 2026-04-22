# 端口配置
BACKEND_PORT=8483
BACKEND_HOST=0.0.0.0
APP_PORT=3015

# 生产环境
ENV=production
STATIC=/static
OUT_DIR=./static/screenshots
NOTE_OUTPUT_DIR=note_results
IMAGE_BASE_URL=/static/screenshots
DATA_DIR=data

# FFmpeg (容器内已安装)
FFMPEG_BIN_PATH=

# 转写器配置
TRANSCRIBER_TYPE=fast-whisper
WHISPER_MODEL_SIZE=base

# HuggingFace 镜像 (国内加速)
HF_ENDPOINT=https://hf-mirror.com

# WebDAV 加密密钥 (必须修改)
WEBDAV_ENCRYPTION_KEY=请设置32字符以上随机密钥

# 数据库路径 (默认即可)
DATABASE_URL=sqlite:///bili_note.db
