# === 前端构建阶段 ===
FROM node:18-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 使用淘宝镜像加速
RUN pnpm config set registry https://registry.npmmirror.com

# 设置工作目录
WORKDIR /app

# 先复制依赖文件，利用缓存
COPY ./BillNote_frontend/package.json ./BillNote_frontend/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制剩余源码
COPY ./BillNote_frontend .

# 设置生产环境 API 地址（相对路径，通过 nginx 代理）
ENV VITE_API_BASE_URL=/api
ENV VITE_SCREENSHOT_BASE_URL=/static/screenshots

# 构建
RUN pnpm run build

# --- 阶段2：使用 nginx 作为静态服务器 ---
FROM nginx:1.25-alpine

# 删除默认配置（可选）
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY ./BillNote_frontend/deploy/default.conf /etc/nginx/conf.d/default.conf


# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 修复文件权限
RUN chmod -R 755 /usr/share/nginx/html