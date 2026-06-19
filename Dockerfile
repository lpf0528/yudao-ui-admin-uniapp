# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml .npmrc ./

ENV HUSKY=0
ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=6144
# 双重保险：即使未传 --ignore-scripts 也不执行 prepare/husky
ENV npm_config_ignore_scripts=true

# prepare 依赖 scripts/，先复制避免 MODULE_NOT_FOUND
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm init-baseFiles && pnpm build:h5

FROM nginx:1.27-alpine

COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# 后端地址，容器启动时可通过环境变量覆盖
ENV BACKEND_HOST=127.0.0.1
ENV BACKEND_PORT=48080

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$$BACKEND_HOST $$BACKEND_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
