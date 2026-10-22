# Build context: games/, so the build sees the workspace lockfile and the platform packages
FROM node:24.22.0-alpine3.24 AS build

WORKDIR /games

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY platform/p2p/ platform/p2p/
COPY titles/tictactoe/ titles/tictactoe/
RUN corepack enable \
  && pnpm install --frozen-lockfile --include-workspace-root --filter @whenparty/tictactoe... \
  && pnpm --filter @whenparty/tictactoe build

FROM nginx:1.31.7-alpine

COPY --from=build /games/titles/tictactoe/dist/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80
