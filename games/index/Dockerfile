FROM node:26.13.1-alpine3.24 AS build

WORKDIR /games

COPY . .
RUN --mount=type=bind,from=ghcr.io/pnpm/pnpm:12.21.0-alpine,source=/opt/pnpm,target=/opt/pnpm \
  /opt/pnpm/pnpm install --frozen-lockfile --include-workspace-root --filter @whenparty/index... \
  && /opt/pnpm/pnpm --filter @whenparty/index build

FROM nginx:1.31.8-alpine

COPY --from=build /games/index/dist/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80
