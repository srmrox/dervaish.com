# @dervaish/api — Node (node:http + node:sqlite), zero runtime deps.
# Build context is the repo root:  docker build -f apps/api/Dockerfile .

# ---- build: compile TypeScript to dist/ ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/platform-web/package.json apps/platform-web/package.json
RUN npm ci
COPY . .
RUN npm run build -w @dervaish/api

# ---- runtime: just node + dist + db ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8000 \
    HOST=0.0.0.0 \
    DB_PATH=/data/dervaish.db \
    MEDIA_ROOT=/data/mediafiles \
    DERVAISH_LOCAL_MODE=false
# dist/ (compiled server + seed) and db/ (schema.sql + committed seed data)
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/db ./db
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p /data
# Persist the SQLite database (and the seed marker) across redeploys.
VOLUME /data
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
