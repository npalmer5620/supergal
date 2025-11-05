# api/Dockerfile
FROM node:22-alpine

# App paths
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY src ./src

# Default runtime dirs/env
ENV PORT=8787 \
    DB_PATH=/data/app.db \
    UPLOAD_DIR=/uploads \
    NODE_ENV=production

# Create non-root user and dirs
RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data /uploads \
 && chown -R app:app /app /data /uploads

USER app

EXPOSE 8787
CMD ["node", "src/server.js"]
