#!/bin/sh
# Seed the database on first boot only (the seed is destructive — it rebuilds the
# demo catalogue), then start the server. Delete /data/.seeded to force a reseed.
# Env comes from the container (Coolify), so no --env-file here; env.ts reads process.env.
set -e

DB_PATH="${DB_PATH:-/data/dervaish.db}"
DATA_DIR="$(dirname "$DB_PATH")"
mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/.seeded" ]; then
  echo "[entrypoint] first boot — seeding database at $DB_PATH"
  node --experimental-sqlite dist/seed.js
  touch "$DATA_DIR/.seeded"
fi

echo "[entrypoint] starting dervaish-api on ${HOST:-0.0.0.0}:${PORT:-8000}"
exec node --experimental-sqlite dist/server.js
