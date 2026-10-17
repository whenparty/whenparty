FROM nginx:1.31.7-alpine

# Replaces the stock server block: gzip, IPv6 and cache headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets and give them content-hashed names for long-term caching
COPY html/ /usr/share/nginx/html/
RUN --mount=type=bind,source=scripts/fingerprint.sh,target=/tmp/fingerprint.sh \
    sh /tmp/fingerprint.sh /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80
