#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-web}"

run_web() {
  echo "[entrypoint] migrate + collectstatic"
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
  echo "[entrypoint] starting gunicorn"
  exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - --error-logfile -
}

run_worker() {
  echo "[entrypoint] starting celery worker"
  exec celery -A config worker --loglevel="${CELERY_LOGLEVEL:-info}"
}

run_beat() {
  echo "[entrypoint] starting celery beat"
  exec celery -A config beat --loglevel="${CELERY_LOGLEVEL:-info}"
}

case "$ROLE" in
  web) run_web ;;
  worker) run_worker ;;
  beat) run_beat ;;
  *) echo "Unknown role: $ROLE (expected web|worker|beat)"; exit 1 ;;
esac
