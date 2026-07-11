#!/bin/sh
# Write the runtime API base URL into /env.js from the DERVAISH_API_BASE_URL env
# var (default https://api.dervaish.com). Runs at container start via nginx's
# /docker-entrypoint.d hook, so the URL can be changed in Coolify without a rebuild.
set -e

API_BASE_URL="${DERVAISH_API_BASE_URL:-https://api.dervaish.com}"
printf 'window.__DERVAISH_API_BASE_URL__ = "%s";\n' "$API_BASE_URL" > /usr/share/nginx/html/env.js
echo "[dervaish-web] API base URL = $API_BASE_URL"
