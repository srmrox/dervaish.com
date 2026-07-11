# Dervaish API (backend)

Django + DRF + Celery backend for the Dervaish kalam archive. Implements the
**Kalam → Verse → Rendition → media** model (see `docs/Dervaish-Master-Build-Plan.md` §7)
and a manifest-driven media plane (§4A).

## Apps
- `accounts` — custom `User` with role + trust score
- `taxonomy` — controlled vocabularies (genre, language, tradition, era, theme, region)
- `catalog` — `Person`, `Kalam`, `Verse`, `Rendition`, `Credit`, `Collection`
- `media` — `MediaAsset` (audio/video original), `MediaRendition` (variants), `Caption`
- `lyrics` — `RenditionVerseTiming` (per-rendition synced-lyric map over verses)
- `archive` — `ArchiveRecord`, `Citation`, `ProvenanceRecord`, `SourceRating`
- `community` — `Submission`, `KalamRequest`, `RequestUpvote`

## Run locally
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # leave DATABASE_URL blank to use SQLite
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```
Then: `GET /healthz`, `GET /api/v1/kalams/`, `GET /api/v1/kalams/<slug>/`,
`GET /api/v1/renditions/<slug>/` (returns the playback manifest), `/admin/`.

## API (v1)
Public reads: `kalams`, `renditions`, `people`, `collections`, `search/?q=`
(grouped), and `directory/sources` + `directory/mirrors` (federation).

Accounts & user-scoped (token auth — send `Authorization: Token <key>`):
- `POST /api/v1/auth/register/`, `POST /api/v1/auth/login/`, `POST /api/v1/auth/logout/`
- `GET /api/v1/me/`, `PATCH /api/v1/me/preferences/`
- `GET/POST /api/v1/me/library/`, `DELETE /api/v1/me/library/{id}/`
- `GET/POST /api/v1/me/queues/`, `POST /api/v1/me/queues/{id}/items/`,
  `DELETE /api/v1/me/queues/{id}/items/{item_id}/`, `POST /api/v1/me/queues/{id}/reorder/`

Media pipeline (contributor uploads, editor visibility):
- `POST /api/v1/media/upload-sessions/` → pending asset + upload target
  (presigned S3/R2 PUT in prod, or `POST …/assets/{id}/upload/` server-mediated in dev)
- `POST /api/v1/media/assets/{id}/complete/` → enqueue transcoding (Celery)
- `GET /api/v1/media/assets/[{id}/]` → asset + variants + processing status (editor+)

The worker (`media/tasks.py`) probes with ffprobe, transcodes per `media/transcode.py`
profiles (audio → opus+aac, video → mp4 720p + poster), uploads variants, and records
`MediaRendition` rows; the rendition playback manifest then serves them via the mirror
resolver. Run the worker with `celery -A config worker` (or the Docker `worker` role).

## Develop
```bash
pip install -r requirements-dev.txt   # adds ruff
ruff check . && python manage.py check && python manage.py test
```
CI (`.github/workflows/ci.yml`) runs ruff, missing-migration check, system check,
and the test suite against a Postgres service on every push/PR.

## Deploy
See `DEPLOY-COOLIFY.md`.
