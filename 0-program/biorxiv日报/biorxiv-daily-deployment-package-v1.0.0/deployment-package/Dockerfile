# BioRxiv日报 - Docker多阶段构建
# 第一阶段：构建应用

FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装pnpm
RUN npm install -g pnpm

# 复制package文件
COPY biorxiv-final/package*.json ./
COPY biorxiv-final/pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY biorxiv-final/ .

# 设置构建时环境变量
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME="BioRxiv日报"
ARG VITE_APP_VERSION="1.0.0"
ARG NODE_ENV=production

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
ENV NODE_ENV=${NODE_ENV}

# 构建应用
RUN pnpm run build

# 第二阶段：生产环境
FROM nginx:alpine AS production

# 安装必要的工具
RUN apk add --no-cache \
    curl \
    jq \
    bash

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY config/nginx.conf /etc/nginx/conf.d/default.conf

# 复制启动脚本
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 创建日志目录
RUN mkdir -p /var/log/nginx

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 暴露端口
EXPOSE 80 443

# 设置启动命令
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# 标签
LABEL maintainer="BioRxiv日报团队"
LABEL description="BioRxiv日报 - 学术论文聚合和分析平台"
LABEL version="1.0.0"
