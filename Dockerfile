# ---------- ProjectHub: single image (API + web UI) ----------
# Works on linux/amd64 and linux/arm64 (Intel/AMD servers, Apple Silicon, Raspberry Pi 4/5).

# 1) Build the web UI
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2) Build the API
FROM node:22-bookworm-slim AS server
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# 3) Runtime
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080 \
    WEB_DIR=/app/public \
    MIGRATIONS_DIR=/app/migrations \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=server /server/package.json ./
COPY --from=server /server/node_modules ./node_modules
COPY --from=server /server/dist ./dist
COPY server/migrations ./migrations
COPY --from=web /web/dist ./public
RUN chmod -R a+rX /app && mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
