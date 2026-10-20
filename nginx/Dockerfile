FROM nginxinc/nginx-unprivileged:stable-alpine

# Remove the default config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy the custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Ensure nginx can write required temp/runtime files
RUN chown -R nginx:nginx /etc/nginx /tmp /var/cache/nginx /var/run

# Use an unprivileged port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

# Run as non-root
USER nginx

CMD ["nginx", "-g", "daemon off;"]
