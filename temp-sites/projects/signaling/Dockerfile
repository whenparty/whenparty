FROM node:24.22.0-alpine3.24

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# .dockerignore keeps src/tests out of the image
COPY src/ src/

USER node

ENV NODE_ENV=production PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080

CMD ["node", "src/main.mjs"]
