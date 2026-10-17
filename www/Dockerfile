FROM nginx:1.29.3-alpine

# Enable gzip compression for better performance
RUN sed -i 's/#gzip  on;/gzip  on;/' /etc/nginx/nginx.conf && \
    sed -i '/gzip  on;/a \    gzip_vary on;\n    gzip_proxied any;\n    gzip_comp_level 6;\n    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;' /etc/nginx/nginx.conf

# Copy static assets
COPY html/ /usr/share/nginx/html/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80
