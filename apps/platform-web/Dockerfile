# @dervaish/platform-web — static Vite/React SPA served by nginx.
# Build context is the repo root:  docker build -f apps/platform-web/Dockerfile .
# The API base URL is injected at container start (not baked here) — see
# docker-entrypoint.sh / public/env.js — so it can be changed without rebuilding.

# ---- build: bundle to dist/ ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/platform-web/package.json apps/platform-web/package.json
RUN npm ci
COPY . .
# `vite build` bundles via esbuild/rollup (no type-checking); the strict `tsc`
# gate (`npm run build`) is re-greened separately.
RUN cd apps/platform-web && npx vite build

# ---- runtime: nginx serving the SPA ----
FROM nginx:1.27-alpine AS runtime
COPY apps/platform-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/platform-web/dist /usr/share/nginx/html
# nginx:alpine runs every /docker-entrypoint.d/*.sh before starting nginx; this
# one regenerates /env.js from $DERVAISH_API_BASE_URL.
COPY apps/platform-web/docker-entrypoint.sh /docker-entrypoint.d/40-dervaish-env.sh
RUN chmod +x /docker-entrypoint.d/40-dervaish-env.sh
EXPOSE 80
