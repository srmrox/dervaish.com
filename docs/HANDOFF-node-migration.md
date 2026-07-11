# Dervaish — Handoff: Migrate Backend to Node

**Date:** 2026-07-05
**Decision (owner):** Replace the Django/DRF backend with a Node/TypeScript backend. Reason is not a Django defect — it's that the owner can only effectively debug in Node, so the whole stack should be one language. The React frontend **stays**.

Read this top to bottom before writing code. The goal of the migration is a drop-in backend: the existing React app should work **unchanged** against the new server. That means the Node API must reproduce the URL shapes and JSON payloads documented below exactly.

---

## 1. What Dervaish is

A preservation-focused devotional-media archive + listening platform. "Lean player on top, bottomless archive on demand." Data spine:

```
Kalam (a work/poem)
  └── Verse (ordered lines: text_native, transliteration, translations{}, meaning{})
  └── Rendition (a specific recording of the Kalam)
        └── media assets (audio/video) attached to the Rendition
        └── Credit (Person + role, e.g. reciter)
Person (author or performer)
Collection (curated set of renditions)
Federation: MediaMirror + MediaAssetMirror + resolver → where each file can be fetched
```

Availability rule the owner cares about: **only show media that is actually available**, decided by the mirror system. A "local" mirror serves files from disk on the user's own machine.

---

## 2. Current state

### Keep as-is (do NOT rewrite)
- **Frontend:** `D:\repos\dervaish.com\apps\platform-web` — React 19 + Vite + TypeScript + TanStack Query + react-router-dom v7. Fully built (Listen/Search/Library/Community/Mirrors + Studio + Admin). It talks to the backend only through `src/lib/api.ts`, `src/lib/hooks.ts`, and the Vite proxy. If the Node API matches the contract in §5, the frontend needs **zero** changes.
- **Sample media** at repo root: `mediafiles/samples/tanam-farsooda/` → `audio.mp3`, `landscape-1080p.mp4`, `portrait-1080p.mp4`, `lyrics.json` (metadata: title "Tanam Farsooda Jaan Para", voice "Zulfikar Ali").
- **Docs:** `docs/plan.md`, `docs/database.md`, `docs/workflows.md`, `docs/screens.md`, `docs/local-mirror.md`, `docs/STATUS.md`.

### Replace
- **Backend:** `D:\repos\dervaish.com\backend` (Django 5.1 + DRF + Celery, SQLite dev / Postgres prod). This is what moves to Node. Use it as the **reference spec**, not as code to port line-by-line — the serializers and models tell you the exact shapes.

### Open bug being carried over (unsolved)
The one sample rendition ("Tanam Farsooda Jaan Para") shows in the UI with a Play button but plays `0:00` and never starts. The card rendering proves a URL resolved, so the failure is in the **media response**, not the catalog. Most likely causes, in order:
1. **Content-Type** served as `application/octet-stream` instead of `audio/mpeg` → browser refuses to decode (shows 0:00). In Django this needed a `runserver` restart to take effect. **In Node, set the MIME map correctly from day one (see §6).**
2. Returning `206 Partial Content` to a request that has **no** `Range` header (an HTTP violation — Firefox shows duration 0 and stalls). Only send 206 when a `Range` header is present.
3. Wrong `MEDIA_ROOT` / file path → 404.

The frontend now surfaces the real cause: `apps/platform-web/src/lib/player.tsx` fires an `error` listener that prints `NETWORK / DECODE / SRC_NOT_SUPPORTED` + the failing `src`, and `KalamScreen.tsx` shows it as a red line under "Renditions." Keep that — it makes the Node media endpoint trivial to verify.

**First acceptance test for the new backend:** open `http://localhost:<port>/media/samples/tanam-farsooda/audio.mp3` directly. It must **play inline** (not download). Then the player red line must clear and duration must be non-zero.

---

## 3. Recommended Node stack

Nothing here is mandatory, but this keeps the contract easy to hit:

- **Runtime/framework:** Node 20+ with **Fastify** (or Express). Fastify has first-class streaming + `@fastify/static` supports Range out of the box.
- **Language:** TypeScript.
- **ORM:** **Prisma** (migrations + typed client). Postgres for prod, SQLite fine for dev — Prisma supports both.
- **Auth:** token auth to match the frontend (`Authorization: Token <token>`, see §5). A simple opaque token table or JWT wrapped to look like `Token <...>` both work; the frontend just reads `token`/`key`/`access`/`auth_token` from the login response.
- **Validation:** zod.
- **Media serving:** handwritten Range handler (see §6) — do not rely on a static middleware unless you confirm it does 200-without-range / 206-with-range correctly.
- **Background jobs (later):** BullMQ (Redis) replaces Celery for the render pipeline. Not needed for MVP.

Consider generating an OpenAPI spec from the Node side and running `openapi-typescript` so the frontend types (`src/lib/types.ts`) stay in sync — the current types were hand-mirrored from DRF.

---

## 4. Data model (Prisma-ready)

Field names below are the ones the API serializes; keep them. Enums matter — Django had two separate ones that caused a bug this session:

- **Visibility:** `draft | pending | public | unlisted | archived` (drives whether something is shown; public catalog filters `visibility in [public, unlisted]`).
- **EditorialState:** `draft | in_review | published | rejected` (review workflow — **separate** from Visibility; do not conflate).
- **ProtectionLevel:** `open | ...` (rendition rights; `open` = freely playable).
- **PersonRole:** includes `reciter` (used for the credit).
- **MediaKind:** `audio | video`. **ProcessingStatus:** `ready | ...`.
- **MediaMirror.kind:** `r2 | cdn | github | external | local`.

Core entities and the fields the API depends on:

```
Kalam: slug, title, title_native, title_transliterated, summary, author(→Person),
       primary_language, genre, tradition, era, themes[], tags[], visibility
Verse: kalam, order, text_native, transliteration, translations(json), meaning(json)
Person: slug, name, name_native, aliases[], biography, era, region, tradition,
        external_ids(json), visibility
Rendition: kalam, slug, title, duration_ms, year, album, publisher, style,
           protection_level, rights_note, visibility, published_at
Credit: rendition, person, role, display_order, note
Collection: slug, title, description, is_curated, renditions[]
MediaAsset: storage_key, kind, mime_type, original_filename, size_bytes,
            processing_status, source_name, source_url, height
MediaRendition (a variant of an asset): asset, storage_key, container, url,
            bitrate_kbps, height, is_streaming, is_offline_download, processing_status
MediaMirror: slug, name, base_url, kind, is_official, is_active, is_default_enabled,
             verified, carries_all, priority   + url_for(storage_key) helper
MediaAssetMirror: asset, mirror, available, url_override
Rendition.media_assets  ⇄  MediaAsset   (many-to-many)
```

User-side: `User(username, display_name, role, trust_score)`, `SavedItem(user, rendition, created_at)`, `Queue`/`QueueItem`, `Submission`, `KalamRequest`, `Annotation`, `PublishedFile`, `VideoGenerationJob`. Roles: `anonymous | listener | contributor | editor | admin`.

### The mirror resolver (reproduce exactly — this is the availability brain)
Given `storage_key` + asset, return an ordered list (lowest `priority` first) of mirrors that **carry the file**:
```
mirrors = active mirrors, ordered by (priority, name)
for each mirror m:
    ok = m.carries_all
         OR (asset given AND MediaAssetMirror(asset=asset, mirror=m).available)
    skip if not ok
    url = MediaAssetMirror.url_override (if set) else m.url_for(storage_key)
    emit { mirror: m.slug, name: m.name, kind: m.kind, url,
           default_enabled: m.is_default_enabled, priority: m.priority }
```
`m.url_for(key)` = `base_url` joined to `storage_key` (local mirror base_url is `"/media/"` → `/media/samples/tanam-farsooda/audio.mp3`). `has_media` = true if any asset has a `source_url` OR any variant has `url` OR (`storage_key` AND resolver returns ≥1 mirror).

---

## 5. API contract the frontend requires (MUST MATCH)

Base path: **`/api/v1`**. The frontend calls `fetch(`${BASE}/api/v1${path}`)` where `BASE` is empty in dev (same-origin via Vite proxy). Auth header when logged in: `Authorization: Token <token>`. List endpoints are **paginated**: `{ count, next, previous, results[] }`.

### Auth / user
- `POST /auth/register/`
- `POST /auth/login/` → body `{username, password}` → returns `{ token }` (or `key`/`access`/`auth_token`)
- `POST /auth/logout/`
- `GET /me/` → `{ id, username, display_name, role, trust_score }`
- `GET/PUT /me/preferences/`

### Catalog (read surface)
- `GET /kalams/` → paginated `KalamListItem`
- `GET /kalams/{slug}/` → `KalamDetail` (includes `verses[]`, `credits[]`, and `renditions[]` where each Rendition includes the full `playback` manifest)
- `GET /renditions/{slug}/` → `Rendition` (with `playback`)
- `GET /people/` , `GET /people/{slug}/`
- `GET /collections/` , `GET /collections/{slug}/`
- `GET /search/?q=` → `{ kalams[], people[], renditions[], collections[] }` (renditions here are `RenditionRef` with `has_media`)

### Federation
- `GET /directory/sources/`
- `GET /directory/mirrors/` → paginated `MirrorInfo` (**all active mirrors**, ordered by priority,name — local + official + community; frontend badges by `is_official`/`verified`)

### User-scoped
- `GET/POST/DELETE /me/library/` (items expose `rendition_detail: RenditionRef`)
- `GET/POST /me/queues/` (items expose `rendition_detail`)

### Contribution / admin (can be stubbed for MVP, but keep routes)
- `/submissions/`, `/community/requests/`, `/admin/review/submissions/`, `/annotations/`, `/admin/published/`, `/admin/renders/`, `/media/assets/`, `/media/upload-sessions/`

### Exact JSON shapes
Authoritative source is `apps/platform-web/src/lib/types.ts` (already committed) — every interface there is what the endpoints must emit. The two that matter most for the open bug:

```ts
PlaybackManifest = { protection_level: string, variants: PlaybackVariant[] }
PlaybackVariant  = {
  kind: "audio"|"video", storage_key, container, bitrate_kbps, height,
  url,                       // primary (first mirror's url, or variant.url/storage_key)
  mirrors: MirrorUrl[],      // ordered; client picks per user prefs
  streaming, offline_download, source
}
MirrorUrl = { mirror, name, kind, url, default_enabled, priority }
```
Build `get_playback` exactly like `backend/catalog/serializers.py::RenditionSerializer.get_playback`: for each attached asset, for each variant, resolve mirrors → emit variant; if the asset has a `source_url` (e.g. GitHub-hosted original), emit an extra directly-playable `source: true` variant.

---

## 6. Media serving (the correctness-critical part)

Reproduce `backend/config/media_serve.py` in Node. Requirements — all four are load-bearing:

1. **Route:** `GET /media/*` → resolve path under `MEDIA_ROOT` (repo-root `mediafiles/`, overridable by env). **Reject path traversal** (resolved path must stay inside root).
2. **Content-Type from an explicit map** (Node's `mime` is fine, but pin these):
   `.mp3→audio/mpeg .m4a→audio/mp4 .aac→audio/aac .opus/.ogg/.oga→audio/ogg .wav→audio/wav .flac→audio/flac .mp4/.m4v→video/mp4 .webm→video/webm .mov→video/quicktime .m3u8→application/vnd.apple.mpegurl .vtt→text/vtt`. Never let audio go out as `octet-stream`.
3. **Range handling (RFC 7233):**
   - No `Range` header → **200 OK**, full body, `Content-Length: size`, `Accept-Ranges: bytes`.
   - `Range: bytes=start-[end]` → **206 Partial Content**, stream that slice, set `Content-Range: bytes start-end/size` and `Content-Length: sliceLen`.
   - **Never** send 206 without a Range header (this is exactly what makes duration read 0 and playback stall in Firefox).
4. **Stream, don't buffer** (use `fs.createReadStream(path, {start, end})`) so seeking works and large files don't blow memory. Add `Cache-Control: public, max-age=3600`.

In Fastify: either `@fastify/static` with `acceptRanges: true` (verify it obeys rule 3) or a small custom handler. A custom handler is ~40 lines and removes all doubt.

**Verify with:** `curl -I` (expect `Accept-Ranges: bytes`, correct `Content-Type`), then `curl -H "Range: bytes=0-1023" -D - .../audio.mp3` (expect `206` + `Content-Range`), then a plain browser open (expect inline playback).

---

## 7. Frontend integration touch points

- **Vite proxy:** `apps/platform-web/vite.config.ts` proxies `/api`, `/rest`, `/media`, `/healthz` → `localhost:8000`. Point these at the new Node port (or keep 8000 to avoid touching it).
- **API base:** `src/lib/api.ts` uses relative `/api/v1` in dev. No change if the Node server serves that path.
- **Mirror prefs (client-only, localStorage):** `src/lib/mirrors.ts` keys — `dervaish.mirror.overrides`, `dervaish.mirror.custom`, `dervaish.mirror.localbase`. `resolveVariantUrl(variant)` is strict: only mirrors the user has enabled, no raw fallback. For the local mirror, if `localbase` is set it joins `localbase + storage_key`, else uses the mirror's `url`. Availability filtering (`renditionHasMedia`, `availableRenditions`) is built on this. The Node backend just needs to emit correct `mirrors[]`; the picking logic is already in the client.
- **Auth token:** localStorage key `dervaish.token`, sent as `Authorization: Token <token>`.
- **OpenSubsonic:** Django also exposed `/rest/` (Subsonic) — not required for MVP; the main player uses `/api/v1`. Defer.

---

## 8. Suggested migration order

1. **Scaffold** Fastify + TS + Prisma; SQLite dev DB; `.env` with `MEDIA_ROOT` = repo-root `mediafiles`.
2. **Media endpoint first** (`GET /media/*` per §6) and prove `audio.mp3` plays inline. This kills the carried-over 0:00 bug before anything else.
3. **Prisma schema** from §4; seed script equivalent to `seed_demo` + `seed_local_media` (register a `local` mirror with `base_url:"/media/"`, `is_default_enabled:true`, build MediaAssets from the three sample files, one public Rendition "Tanam Farsooda Jaan Para" credited to reciter "Zulfikar Ali" from `lyrics.json`).
4. **Read endpoints** (`/kalams`, `/renditions`, `/people`, `/collections`, `/search`, `/directory/mirrors`) with the exact shapes from §5 — including `get_playback`. At this point the whole Listen/Search/Mirrors experience should light up against Node, and the sample should play end-to-end.
5. **Auth + user-scoped** (`/auth/*`, `/me/*`, `/me/library`, `/me/queues`).
6. **Contribution/admin** endpoints (can start as stubs returning empty paginated lists so the frontend doesn't error).
7. **Later:** BullMQ render pipeline, OpenSubsonic, Postgres, deploy.

Definition of done for MVP parity: the sample rendition plays audio + shows video on the Companion page, the mirror picker lists the local mirror, and availability filtering hides anything without media — all with the **unchanged** React app.

---

## 9. Key files to read in the old backend (as spec)
- `backend/catalog/serializers.py` — the exact JSON shapes (esp. `get_playback`, `has_media`).
- `backend/catalog/models.py` + `backend/common/models.py` — fields + the Visibility/EditorialState enums.
- `backend/federation/services.py` — the mirror resolver algorithm (§4).
- `backend/federation/models.py` — MediaMirror/MediaAssetMirror + `url_for`.
- `backend/config/media_serve.py` — the Range/MIME server to reproduce (§6).
- `backend/config/api.py` — the full route list (§5).
- `backend/catalog/management/commands/seed_local_media.py` — what the seed must create.
- `apps/platform-web/src/lib/types.ts` — the contract, TypeScript-side.

## 10. Gotchas learned this session (don't relearn them)
- Two separate enums: `Visibility` (has `public`) vs `EditorialState` (has `published`, no `public`). Rendition/Person visibility uses **Visibility**.
- On Windows, MIME lookup returned `octet-stream` for `.mp3` → use the explicit map.
- The PWA service worker cached stale JS aggressively; it's now a kill-switch disabled in dev (`apps/platform-web/public/sw.js`, registration gated to PROD in `main.tsx`). Keep it disabled in dev to avoid ghost bugs.
- 206-without-Range = duration 0. Get §6 rule 3 right.
