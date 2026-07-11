# Archived — Django/DRF backend (reference spec only)

**Archived:** 2026-07-05 · **Reason:** backend migrated to Node/TypeScript (Fastify + Prisma), see `docs/status.html` and `HANDOFF-node-migration.md`.

This is the **old Django 5.1 + DRF + Celery backend**, kept as the authoritative reference for the
JSON shapes, enums, and the mirror resolver the new Node API must reproduce. It is **not** run or deployed.

Excluded from the archive copy: `.venv/`, `__pycache__/`, `*.pyc`, `db.sqlite3` (regenerate/seed on the Node side).

Highest-value files when building the Node backend:
- `catalog/serializers.py` — exact JSON shapes (`get_playback`, `has_media`).
- `catalog/models.py`, `common/models.py` — fields + Visibility vs EditorialState enums.
- `federation/services.py` — the mirror resolver algorithm.
- `federation/models.py` — MediaMirror / MediaAssetMirror + `url_for`.
- `config/media_serve.py` — the Range/MIME media server to reproduce.
- `config/api.py` — the full route list.
- `catalog/management/commands/seed_local_media.py` — what the seed must create.

The live/new backend is at `apps/api/`.
