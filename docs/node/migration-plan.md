# Migration plan

The order is chosen so the sample plays end-to-end as early as possible and the frontend lights up
incrementally. Each stage maps to a lane in `docs/status.html`. Mark a stage done only when both its
automated and manual checks pass.

## Stages

### Stage 1 · Scaffold  ✅ built
`node:http` server + TypeScript (`tsc`) at `apps/api/`; `node:sqlite` for data; `.env` with
`MEDIA_ROOT=../../mediafiles`, `PORT=8000`, `DB_PATH=./dervaish.db`. `/healthz` + `/api/v1`, hand-set
CORS exposing media headers. Zero runtime dependencies. **Done when:** `/healthz` → 200.
_Status: scaffolded and boot-tested._

### Stage 2 · Media endpoint  (do this first after scaffold)
`GET /media/*` per [media-serving.md](./media-serving.md). **Done when:** `audio.mp3` plays inline
(200, `audio/mpeg`, `Accept-Ranges`), `Range → 206`, traversal blocked. This kills the 0:00 bug
before anything else depends on it.

### Stage 3 · SQL schema + seed
Real schema (`db/schema.sql`) from [data-model.md](./data-model.md); seed per [seeding.md](./seeding.md) (register the
local mirror, build the three sample assets, one public "Tanam Farsooda" rendition credited to
reciter "Zulfikar Ali"). **Done when:** `/kalams/` non-empty, local mirror registered, "Tanam"
searchable.

### Stage 4 · Read endpoints
`/kalams`, `/renditions`, `/people`, `/collections`, `/search`, `/directory/*` with the exact shapes
in [api-contract.md](./api-contract.md) — including `get_playback` and the mirror resolver. **Done
when:** the whole Listen/Search/Mirrors experience lights up against Node and the sample plays
end-to-end in the real UI.

### Stage 5 · Auth + user-scoped
`/auth/*`, `/me/*`, `/me/library`, `/me/queues` per [auth-users.md](./auth-users.md). **Done when:**
login returns a token and the authed surfaces work.

### Stage 6 · Contribution + admin
`/submissions`, `/community/requests`, `/admin/review`, `/annotations`, `/admin/published`,
`/admin/renders`, `/media/*` — start as stubs returning empty paginated lists so the frontend
doesn't error; then build `apply_submission`. See [contribution-admin.md](./contribution-admin.md).

### Stage 7 · Later (deferred)
Render pipeline replacing Celery — prefer a **native** job queue (a SQLite `job` table polled by a
worker, or `node:worker_threads`) over BullMQ/Redis to stay dependency-free; OpenSubsonic `/rest/`
full set; deploy. Not required for MVP parity.

## Definition of done (MVP parity)

The sample rendition plays audio + shows video on the Companion page, the mirror picker lists the
local mirror, and availability filtering hides anything without media — all with the **unchanged**
React app.

## Dependencies at a glance

```
Stage 1 (scaffold)
   └─► Stage 2 (media)  ─┐
   └─► Stage 3 (schema+seed) ─► Stage 4 (reads) ─► Stage 5 (auth) ─► Stage 6 (contrib/admin)
                                     ▲                                   
   Stage 2 + Stage 3 together let Stage 4 return real playable manifests. 
   Stage 7 hangs off "everything works" and is deferred.
```

## Parking lot / open questions (refine)

- `node:sqlite` is still marked experimental and needs Node ≥ 22.5 + `--experimental-sqlite`; pin the
  Node version and track its stabilisation.
- Prod DB: stay on SQLite (WAL + file backup / litestream) to keep zero deps, or accept the `pg`
  dependency for Postgres — a deliberate trade, not a default.
- Preserve Django users on import, or fresh accounts only (scrypt) — see auth-users.md.
- Exact fields for community/content/video models (read the archived files).
- Keeping `apps/platform-web/src/lib/types.ts` in sync by hand vs generating it (any generator is a
  dependency — weigh against the minimal-deps rule).
- Re-do the Coolify/Docker deploy for a plain Node process (Django-era files archived).
