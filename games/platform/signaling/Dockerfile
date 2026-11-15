FROM node:26.13.1-alpine3.24

WORKDIR /games

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platform/signaling/package.json platform/signaling/
COPY platform/transport/package.json platform/transport/
COPY platform/rooms/package.json platform/rooms/
RUN --mount=type=bind,from=ghcr.io/pnpm/pnpm:12.21.0-alpine,source=/opt/pnpm,target=/opt/pnpm \
  /opt/pnpm/pnpm install --frozen-lockfile --prod --filter @whenparty/signaling... \
  && rm -rf /root/.local/share/pnpm /root/.cache

COPY platform/signaling/src/ platform/signaling/src/
COPY platform/transport/src/ platform/transport/src/
COPY platform/rooms/src/ platform/rooms/src/

USER node

ENV NODE_ENV=production PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080

CMD ["node", "platform/signaling/src/main.mjs"]
