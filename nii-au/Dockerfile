FROM nginx:1.31.8-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY html/ /usr/share/nginx/html/
RUN --mount=type=bind,source=scripts/fingerprint.sh,target=/tmp/fingerprint.sh \
    sh /tmp/fingerprint.sh /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80
