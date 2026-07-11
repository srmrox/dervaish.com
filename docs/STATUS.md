# Dervaish — Build Status Dashboard

_Living tracker of built vs. planned. Update as items land. Last updated:
2026-07-04._

**Legend**
✅ done & verified/tested · 🟢 built, not yet compiled/run here (needs local
verify) · 🟡 scaffolded — needs migration/worker/install to function · 🟠 partial ·
⬜ not started · 🗄️ deferred

> ⚠️ **Verification note.** The pre-existing backend apps have tests (green). Almost
> everything added in the recent build sessions (platform-web + the community/
> admin/content/video_generation/subsonic code) has **not been compiled, migrated,
> or run** in this environment — mark it verified only after a local run.

---

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 — Cleanup + web foundation | git repair, remove dead folders, `platform-web` skeleton (tokens, API client, hooks, session, player, UI kit, router, shell, PWA manifest) | 🟢 |
| 2 — Read surface | Listen/Search/Kalam/Companion/Person/Collection/Library/Queues/Account/Auth wired to live reads + auth | 🟢 |
| 3 — Contribution backend + Studio | `/submissions/` + `/community/requests/`; Studio dashboard + intake + transcribe/timing/translate/context + my-submissions | 🟢 (backend no migration) |
| 4 — Admin review + apply | `IsEditor`, `apply_submission` → canonical, `/admin/review/submissions/`; admin dashboard + review UI | 🟢 (no migration) |
| 5 — Render + publish | `content` app (Annotation, PublishedFile, Markdown publisher) + `video_generation` app (job, payload, worker task); admin render/publish UI | 🟡 needs `makemigrations content video_generation` |
| 6 — Distribution + polish | OpenSubsonic `/rest/` subset, PWA service worker, `useDocumentTitle`, smoke test | 🟠 partial |

---

## Backend (`backend/`) — apps & endpoints

| Area | What | Status |
|---|---|---|
| accounts | token auth, `/me`, `/me/preferences`, register/login/logout | ✅ tested |
| taxonomy | `VocabularyTerm` (genre/language/tradition/era/theme/region) | ✅ tested |
| catalog | Kalam, Verse, Rendition, Credit, Collection, Queue, SavedItem, PlaybackState | ✅ tested |
| media | MediaAsset, encodings, upload sessions, FFmpeg transcode task, manifest | ✅ tested |
| lyrics | `RenditionVerseTiming` | ✅ model |
| archive | ArchiveRecord, Citation, Provenance, SourceRating, JSON-LD | ✅ tested |
| federation | ContentSource, MediaMirror, resolver, `/directory/*` | ✅ tested |
| catalog reads | `/kalams`, `/renditions`, `/people`, `/collections`, `/search` | ✅ tested |
| community | `Submission`, `KalamRequest`, `RequestUpvote` models | ✅ model |
| community endpoints | `/submissions/` (POST/GET mine), `/community/requests/` (+upvote) | 🟢 |
| admin review | `/admin/review/submissions/` (`review`, `apply`→canonical) | 🟢 |
| content | Annotation, PublishedFile, DB→Markdown publisher, `/annotations`, `/admin/published` | 🟡 migration |
| video_generation | VideoGenerationJob, `build_render_payload`, `render_video_job` task, `/admin/renders` | 🟡 migration |
| subsonic | `/rest/` ping, getLicense, getLyricsBySongId, stream | 🟢 (no auth yet) |

---

## Frontend (`apps/platform-web`) — 24 screens

| Surface | Screens | Status |
|---|---|---|
| Foundation | tokens.css, api client, TanStack hooks, session, audio player, UI kit, router, shell + playback bar, PWA manifest + SW | 🟢 |
| Player / Wiki | Listen, Search, Kalam, Rendition/Companion, Person, Collection, Library, Queues, Account, Auth | 🟢 |
| Studio | dashboard, intake, transcribe, timing (flagship), translate, context, submissions | 🟢 |
| Community | requests, request | 🟢 |
| Admin | dashboard, review/approve, renders, publish | 🟢 |

All wired to real endpoints/mutations; **none compiled/run here.**

---

## Data model coverage

Kalam · Verse (text/translit/translations/meaning) · Rendition · Credit · taxonomy ·
Collection/Queue/SavedItem/PlaybackState · MediaAsset/encoding/mirror · archive —
**all present & migrated** (✅). Annotation · PublishedFile · VideoGenerationJob —
**modelled, not migrated** (🟡).

---

## Infrastructure & ops

| Item | Status |
|---|---|
| Cloudflare R2 media storage | 🟡 config present (`USE_S3`/`S3_*`), not provisioned |
| Media mirror registry (federation) | ✅ backend |
| OneDrive/SharePoint cold backup | ⬜ manual, not automated |
| Content repo (DB→Markdown, git commit) | 🟡 files written; git commit external |
| Local i9/RTX 5090 render worker bridge | 🟡 payload built; worker not connected |
| PWA installability (manifest + SW) | 🟢 · icons ⬜ (`public/icon-192/512.png`) |
| OpenSubsonic distribution | 🟠 subset, no auth |
| Coolify deploy (backend) | ✅ packaged |
| CI (GitHub Actions) | ⚠️ predates new apps — review |

---

## Deferred / not started 🗄️

SSR / pre-render for public SEO · offline downloads · Subsonic auth + full method
set · a11y/RTL audit · PWA icons · corrections + verification-voting (models + UI) ·
source-intake auto-fetch (yt-dlp etc.) · direct canonical writes for `context` /
`source` submissions · automated mirror replication.

---

## Immediate next actions

1. `cd backend && python manage.py makemigrations content video_generation && python manage.py migrate`
2. `cd apps/platform-web && npm install && npm run dev` — fix first-run TS/runtime nits (likely spots: admin screens, `apply_submission` field lookups, login token key).
3. Run `python manage.py test` (backend) after migrations.
4. Add PWA icons; verify the OpenSubsonic responses against a real client.
5. Connect the local 5090 worker to the Celery broker to consume `video_generation` jobs.

---

## How to keep this updated

Flip a status cell when an item is verified locally (🟢/🟡 → ✅). Add rows as new
work appears. Keep the ⚠️ verification note honest — "built" ≠ "works" until run.
