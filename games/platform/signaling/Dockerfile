FROM node:26.13.1-alpine3.24 AS build

WORKDIR /games

COPY . .
RUN --mount=type=bind,from=ghcr.io/pnpm/pnpm:12.21.0-alpine,source=/opt/pnpm,target=/opt/pnpm \
  /opt/pnpm/pnpm install --frozen-lockfile --prod --filter @whenparty/signaling... \
  && mkdir /app \
  && cp -a package.json node_modules /app/ \
  && /opt/pnpm/pnpm --filter @whenparty/signaling... ls --depth -1 --parseable | while read -r package; do \
    folder=${package#/games/}; \
    mkdir -p "/app/$(dirname "$folder")"; \
    cp -a "$package" "/app/$folder"; \
  done

FROM node:26.13.1-alpine3.24

WORKDIR /games

COPY --from=build /app/ ./

USER node

ENV NODE_ENV=production PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080

CMD ["node", "platform/signaling/src/main.mjs"]
