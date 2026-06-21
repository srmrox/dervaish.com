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

## Deploy
See `DEPLOY-COOLIFY.md`.
