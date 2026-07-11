# Contribution & admin

Powers Studio (contributor micro-tasks) and Admin (review → apply → publish/render). For **MVP
parity these can be stubs** returning empty paginated lists so the frontend doesn't error — the main
player experience doesn't depend on them. Build them out after Stages 1–5 land.

Exact model fields: `archive/backend-django/community/models.py`, `content/models.py`,
`video_generation/models.py`. Route registration: `archive/backend-django/config/api.py`.

## Endpoints (keep the routes; stub the bodies)

| Path | Auth | Stub behaviour | Real behaviour |
|------|------|----------------|----------------|
| `/submissions/` | authed | empty paginated | contributor's own submissions (all Studio micro-tasks) |
| `/community/requests/` | public list | empty paginated | KalamRequest list + `POST` upvote |
| `/admin/review/submissions/` | editor+ | empty paginated / 403 | list/inspect/approve → **apply to canonical** |
| `/annotations/` | authed | empty paginated | Annotation CRUD |
| `/admin/published/` | editor+ | empty paginated / 403 | PublishedFile list (DB→Markdown publisher) |
| `/admin/renders/` | editor+ | empty paginated / 403 | VideoGenerationJob list + trigger |
| `/media/assets/` | editor+ | empty paginated / 403 | MediaAsset list/detail (upload pipeline) |
| `/media/upload-sessions/` | authed | empty paginated | chunked upload sessions |

> A stub that returns `{count:0,next:null,previous:null,results:[]}` (or `403` when role-gated) is
> enough to make the Stage 6 cards in `docs/status.html` pass ("route exists"). The harness treats a
> `401/403` as "route exists · gated".

## Submission → canonical apply (the one bit of real logic)

The Django flow (`community` + `admin_views`): a contributor submits a micro-task (transcription,
timing, translation, context). An editor reviews and **applies** it, which writes to the canonical
catalog — e.g. creating/updating `Verse` rows, rendition timings, or `translations`. Reproduce
`apply_submission` when you build Stage 6; until then, review endpoints can be read-only stubs.

## Entities to reproduce (sketch)

- **Submission** — `{ author, kind, payload(json), status, target refs }`; kinds cover the Studio
  tasks (intake, transcribe, timing, translate, context).
- **KalamRequest** + **RequestUpvote** — community requests with upvotes.
- **Annotation** — notes/annotations on catalog entities.
- **PublishedFile** — output of the DB→Markdown publisher (content repo).
- **VideoGenerationJob** — render payload + status; later consumed by a **native** worker (a SQLite
  `job` table polled by a worker process, or `node:worker_threads`) — replaces Celery + the local
  5090 render worker, without adding BullMQ/Redis.

**TODO/refine:** read the three archived model files and pin exact fields before implementing.

## Later (Stage 7)
Native render pipeline replacing Celery (SQLite `job` table / `node:worker_threads`, not
BullMQ/Redis); OpenSubsonic `/rest/` full method set; deploy. Not needed for MVP parity.
