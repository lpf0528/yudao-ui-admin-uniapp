# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

ENV HUSKY=0
ENV NODE_OPTIONS=--max-old-space-size=6144

RUN pnpm install --frozen-lockfile

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
