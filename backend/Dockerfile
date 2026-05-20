FROM python:3.11-slim

# 可配置镜像源（构建时可通过 --build-arg 覆盖）
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

RUN rm -f /etc/apt/sources.list && \
    rm -rf /etc/apt/sources.list.d/* && \
    echo "deb https://${APT_MIRROR}/debian bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://${APT_MIRROR}/debian bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://${APT_MIRROR}/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# 确保 PATH 中包含 ffmpeg 路径（可选）
ENV PATH="/usr/bin:${PATH}"

# 设置 Hugging Face 镜像源环境变量
ENV HF_ENDPOINT=https://hf-mirror.com

WORKDIR /app
COPY ./backend /app
RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt

RUN mkdir -p /app/note_results /app/static/screenshots /app/static/covers /app/data/data

CMD ["python", "main.py"]
