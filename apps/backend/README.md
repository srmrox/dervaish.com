# Dervaish Backend

Greenfield Django backend for the Dervaish rebuild described in `docs/plan.md`.

This scaffold establishes:

- Django, DRF, Celery, PostgreSQL, Redis, and S3-compatible settings
- core apps for accounts, audit, media, catalog, archive, lyrics, community, video generation, public APIs, and admin workflows
- canonical Phase 1 models and minimal seed fixtures
- Phase 2 media upload-session, processing-job, rendition, derivative, and playback-manifest APIs
- Phase 3 public catalog/archive APIs, archive admin workflows, and archive JSON-LD export
- Phase 4 lyric editor APIs, import/export, saved language preferences, and companion view shell
- Phase 5 community submissions, correction drafts, verification/dispute votes, track requests, upvotes, review actions, audit logs, and trust scoring
- Phase 6 Celery-managed lyric-video jobs with render payloads, logs, preview/output assets, cancellation, and publish approval
- Phase 7 public archive/listening UI workflow shell with Listen, Companion, Archive, Submit, Community, Admin, and sticky playback surfaces
- Phase 8 import/export and polish: dry-run import batches, Dervaish/MediaCMS/Omeka S import adapters, search, archive export, readiness, metrics, and API throttling

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

Phase 4 lyrics endpoints:

- `GET /api/lyrics/sets/` and `GET /api/lyrics/sets/{id}/`
- `POST /api/lyrics/sets/{id}/languages/`
- `PUT /api/lyrics/sets/{id}/segments/`
- `POST /api/lyrics/sets/{id}/import/`
- `GET /api/lyrics/sets/{id}/export/{webvtt|lrc|ttml|json}/`
- `GET /api/me/lyric-preferences/{track_id}/`
- `PUT /api/me/lyric-preferences/{track_id}/`

Phase 5 community endpoints:

- `POST /api/submissions/`
- `POST /api/submissions/{id}/submit/`
- `PATCH /api/submissions/{id}/review/`
- `POST /api/submissions/{id}/publish/`
- `POST /api/submissions/{id}/corrections/`
- `POST /api/submissions/{id}/verifications/`
- `GET /api/community/submissions/`
- `GET /api/community/track-requests/`
- `POST /api/community/track-requests/`
- `POST /api/community/track-requests/{id}/upvote/`
- `PATCH /api/community/track-requests/{id}/status/`

Phase 6 video generation endpoints:

- `GET /api/video-generation/jobs/`
- `POST /api/video-generation/jobs/`
- `GET /api/video-generation/jobs/{id}/`
- `POST /api/video-generation/jobs/{id}/cancel/`
- `POST /api/video-generation/jobs/{id}/publish/`

Phase 8 import/export and ops endpoints:

- `GET /api/search/?q=...`
- `GET /api/export/archive-records/?type=json`
- `GET /api/export/archive-records/?type=csv`
- `GET /ready/`
- `GET /metrics/`
- `GET /api/imports/batches/`
- `POST /api/imports/batches/`
- `POST /api/imports/batches/{id}/run/`
