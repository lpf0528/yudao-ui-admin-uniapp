# syntax=docker/dockerfile:1
#
# 芋道管理后台 · 移动端（uni-app H5）Docker 镜像
# 构建方式参考 yudao-ui-admin-vue3：Node 多阶段构建 + Nginx 托管静态资源
#
# 构建命令：
#   docker build -t eatsleeprun/yudao-ui-admin-uniapp .
#
# 运行命令（与 docker-compose 中 yudao-server 同网络）：
#   docker run -d -p 8080:80 \
#     -e BACKEND_HOST=yudao-server \
#     -e BACKEND_PORT=48080 \
#     eatsleeprun/yudao-ui-admin-uniapp

# ======================== Stage 1: 构建 H5 静态资源 ========================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /app

# Alpine 下 uni-app / esbuild 需要；git 供 prepare 脚本中 husky 使用
RUN apk add --no-cache libc6-compat git

COPY package.json pnpm-lock.yaml .npmrc ./

# prepare 会执行 init-baseFiles，需提前复制 scripts/
COPY scripts ./scripts

ENV HUSKY=0
ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=6144

# 允许 esbuild 等包执行 postinstall（勿加 --ignore-scripts，否则 H5 组件可能异常）
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm init-baseFiles && pnpm build:h5

# ======================== Stage 2: Nginx 托管 ========================
FROM nginx:1.27-alpine AS runner

LABEL org.opencontainers.image.title="yudao-ui-admin-uniapp"
LABEL org.opencontainers.image.description="芋道管理后台移动端 H5（uni-app）"

COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# 默认同 docker-compose 网络内访问 yudao-server；启动时可覆盖
ENV BACKEND_HOST=yudao-server
ENV BACKEND_PORT=48080

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["/bin/sh", "-c", "envsubst '$$BACKEND_HOST $$BACKEND_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
