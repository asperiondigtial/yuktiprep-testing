FROM nginxinc/nginx-unprivileged:stable-alpine

# Remove default site config (path is the same in the unprivileged image)
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Unprivileged users can't bind to ports below 1024, so use 8080
EXPOSE 8080

# Healthcheck (busybox wget is included in alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

# Run as non-root (fixes DS-0002)
USER nginx

CMD ["nginx", "-g", "daemon off;"]
