# Build context: games/, so pnpm can use the workspace lockfile
FROM node:24.22.0-alpine3.24

WORKDIR /games

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platform/signaling/package.json platform/signaling/
RUN corepack enable \
  && pnpm install --frozen-lockfile --prod --filter @whenparty/signaling \
  && rm -rf /root/.local/share/pnpm /root/.cache

# games/.dockerignore keeps the tests out of the image
COPY platform/signaling/src/ platform/signaling/src/

USER node

ENV NODE_ENV=production PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080

CMD ["node", "platform/signaling/src/main.mjs"]
