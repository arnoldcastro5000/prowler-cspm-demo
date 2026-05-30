# Stage 1: build the React app
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Pre-compress JS, CSS, and HTML at build time (level 6 — balanced speed/size)
RUN find /app/dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) \
    -exec gzip -6 -k {} \;

# Stage 2: serve with nginx on port 8080
FROM nginx:1.30-alpine@sha256:5f979dcfed4ce6461873f087e8c980d6e29b084b9e8776d9704a7e989b5f4898
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx \
    && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid \
    && sed -i '/^user /d' /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
USER nginx
CMD ["/entrypoint.sh"]
