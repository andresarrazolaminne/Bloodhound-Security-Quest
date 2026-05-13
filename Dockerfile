FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Dedicated subdomain deployment uses root base by default.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ARG VITE_ADMIN_API_TOKEN=admin123
ENV VITE_ADMIN_API_TOKEN=${VITE_ADMIN_API_TOKEN}

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

COPY package*.json ./
# El bundle de server incluye referencias al módulo vite.config en runtime,
# por lo que necesitamos dependencias de dev (vite/plugins) para evitar ERR_MODULE_NOT_FOUND.
RUN npm ci && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docker/uploads-seed/ /app/uploads/

ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0 \
    UI_BASE_PATH=/ \
    UPLOADS_DIR=/app/uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
