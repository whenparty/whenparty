FROM node:26.13.1-alpine3.24 AS build
WORKDIR /blog
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY eleventy.config.js ./
COPY src/ src/
RUN npx @11ty/eleventy

FROM nginx:1.31.8-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /blog/_site/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80
