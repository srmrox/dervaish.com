# Dervaish Backend

Greenfield Django backend for the Dervaish rebuild described in `docs/plan.md`.

This scaffold establishes:

- Django, DRF, Celery, PostgreSQL, Redis, and S3-compatible settings
- core apps for accounts, audit, media, catalog, archive, lyrics, community, video generation, public APIs, and admin workflows
- canonical Phase 1 models and minimal seed fixtures
- Phase 2 media upload-session, processing-job, rendition, derivative, and playback-manifest APIs
- Phase 3 public catalog/archive APIs, archive admin workflows, and archive JSON-LD export

Install dependencies from this directory:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata seeds/minimal_seed.json
python manage.py test
```

Phase 2 media endpoints:

- `POST /api/media/upload-sessions/` creates a pending `MediaAsset` and upload URL.
- `POST /api/media/upload-sessions/{id}/complete/` marks the upload complete and queues processing.
- `GET /api/media/assets/` lists media assets with renditions and derivatives.
- `POST /api/media/assets/{id}/process/` queues processing for an existing asset.
- `GET /api/media/processing-jobs/` exposes processing state for staff users.
- `GET /api/catalog/tracks/{id}/playback/` returns the playback manifest for a track.

Phase 3 catalog and archive endpoints:

- `GET /api/catalog/collections/` and `GET /api/catalog/collections/{slug}/`
- `GET /api/catalog/people/` and `GET /api/catalog/people/{slug}/`
- `GET /api/catalog/tracks/` and `GET /api/catalog/tracks/{id}/`
- `GET /api/archive/records/` and `GET /api/archive/records/{slug}/`
- `GET /api/archive/records/{slug}/jsonld/`
- `GET /api/archive/citations/`
- `GET /api/archive/vocabularies/`
- `GET /api/archive/provenance/`
