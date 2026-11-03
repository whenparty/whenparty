proxy_intercept_errors on;
error_page 404 /_errors/404.html;

location = /_errors/404.html {
    internal;
    alias /etc/nginx/conf.d/errors/404.html;
}

location = /_errors/404.css {
    add_header Cache-Control "no-cache";
    alias /etc/nginx/conf.d/errors/404.css;
}
