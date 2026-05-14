# Dervaish

Dervaish is a greenfield preservation-focused devotional media archive and listening platform.

The active implementation is:

- `apps/backend`: Django, Django REST Framework, Celery, PostgreSQL, Redis, and S3-compatible storage.
- `apps/platform-web`: React, Vite, API-backed listening and preservation UI.

The previous Fastify API, prototype web shell, mobile shell, shared TypeScript packages, standalone video worker, and vendored reference repositories have been removed from the active workspace. MediaCMS and Omeka S remain conceptual references only, as documented in `docs/plan.md`.

## Backend

Create a virtual environment and install the backend dependencies:

```bash
cd apps/backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata seeds/minimal_seed.json
python manage.py test
```

For local SQLite checks, set `DJANGO_USE_SQLITE=1`.

```bash
DJANGO_USE_SQLITE=1 python manage.py check
DJANGO_USE_SQLITE=1 python manage.py makemigrations --check --dry-run
DJANGO_USE_SQLITE=1 python manage.py test
```

Run the backend API:

```bash
python manage.py runserver 0.0.0.0:8000
```

Local services for the production-shaped path are declared in `docker-compose.yml`:

- PostgreSQL for durable catalog, archive, submission, and job data.
- Redis for Celery queues.
- MinIO for S3-compatible original, rendition, caption, thumbnail, waveform, and generated media storage.

## Platform Web

Install JavaScript dependencies from the repository root:

```bash
npm install
```

Run the web app:

```bash
VITE_DERVAISH_API_BASE_URL=http://localhost:8000 npm run dev:web
```

Build and typecheck:

```bash
npm run typecheck
npm run build
```

The web app is API-only. It expects a running Dervaish backend and does not fall back to bundled mock catalog data.

## Browser QA

Install Playwright Chromium once:

```bash
npx playwright install chromium
```

With the backend running and seeded, run:

```bash
VITE_DERVAISH_API_BASE_URL=http://localhost:8000 npm run test:e2e
```

The Playwright smoke suite covers desktop and mobile first paint, workflow navigation, sticky playback controls, RTL/LTR lyric rendering, archive responsiveness, submission form focus, and protected/empty operational states.

## Design and Architecture

- `docs/plan.md`: greenfield architecture and phased rebuild plan.
- `docs/design-system.md`: UI and workflow design rules.
- `docs/refactor-redundancy-and-qa.md`: QA report and redundancy inventory.
