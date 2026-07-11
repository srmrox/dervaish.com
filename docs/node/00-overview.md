# Overview

## What Dervaish is

A preservation-focused devotional-media archive + listening platform.

The data spine:

```
Kalam (a work/poem)
  ├── Verse    (ordered lines: text_native, transliteration, translations{}, meaning{})
  └── Rendition (a specific recording of the Kalam)
        ├── MediaAsset  (audio/video files attached to the rendition)
        └── Credit      (Person + role, e.g. reciter)
Person      (author or performer)
Collection  (curated set of renditions)
Federation: MediaMirror + MediaAssetMirror + resolver → where each file can be fetched
```

The rule the project cares about most: **only show media that is actually available**, decided by
the mirror system. A "local" mirror serves files from disk on the user's own machine.

## Why the backend is moving to Node

The decision (2026-07-05) is to replace the Django/DRF backend with a Node/TypeScript backend.
The reason is **not** a Django defect — it's that the owner can only effectively debug in Node, so
the whole stack should be one language. The React frontend **stays**.

- **Kept unchanged:** `apps/platform-web/` (React 19 + Vite + TanStack Query + react-router v7).
- **Archived as spec:** `archive/backend-django/` (Django 5.1 + DRF + Celery).
- **New:** `apps/api/` (Node `node:http` + `node:sqlite`, TypeScript — zero runtime deps).

## Target architecture: a headless backend, many clients

The end state is a clean split between a **standalone backend service** and the clients that consume
it. The backend is headless — it renders no HTML and knows nothing about any particular UI. It
exposes stable HTTP contracts; anything that speaks them is a first-class client. The React web app
is just the first client, not a privileged one.

```
        clients (interchangeable, contract-only coupling)
  ┌────────────┬──────────────────────┬───────────────────────┬─────────────┐
  │ React web  │ OpenSubsonic apps    │ future mobile/desktop │ third-party │
  │ (platform- │ (DSub, Symfonium,    │ (native players)      │ integrations│
  │  web)      │  play:Sub, …)        │                       │             │
  └─────┬──────┴──────────┬───────────┴───────────┬───────────┴──────┬──────┘
        │ /api/v1 (JSON)  │ /rest/ (Subsonic)     │ /api/v1          │ /api/v1
        ▼                 ▼                       ▼                  ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                   apps/api  —  Node backend (node:http)                   │
  │   data plane           control plane            media plane               │
  │   /api/v1/*            /rest/*  (Subsonic)      /media/*  (HTTP Range)    │
  │        └──────────── shared services (catalog, auth, resolver) ─────────┘ │
  │                              │                        │                   │
  └──────────────────────────────┼────────────────────────┼───────────────────┘
                                 ▼                        ▼
                       node:sqlite → DB         MEDIA_ROOT + mirror registry
                        (SQLite file)          (local disk, R2/CDN, GitHub raw…)
```

Three surfaces, one service:

- **Data plane — `/api/v1/*` (JSON).** The catalogue + user API the React app uses. Versioned so
  clients can depend on it. See [api-contract.md](./api-contract.md).
- **Control plane — `/rest/*` (OpenSubsonic).** A Subsonic-compatible surface so the **existing
  Subsonic ecosystem** (DSub, Symfonium, play:Sub, Sonixd, etc.) can browse and stream the archive
  with zero bespoke client work. It's a thin adapter that reuses the same services as `/api/v1` —
  not a second backend. Currently deferred (Stage 7) but the architecture reserves the seam for it
  now so it isn't bolted on later.
- **Media plane — `/media/*` (HTTP Range).** Bytes are served over standards-based ranged HTTP, so
  **any** player — a browser `<audio>`/`<video>`, a Subsonic app, VLC, a download manager — can
  stream or seek directly without going through the web UI. This is the key enabler for "other
  clients can also access the media." See [media-serving.md](./media-serving.md).

What makes this separation real:

- **Client-agnostic auth.** Token auth (`Authorization: Token <token>`) works the same for a browser,
  a mobile app, or a Subsonic client — no cookies or web-session coupling. See
  [auth-users.md](./auth-users.md).
- **Media is addressable, not embedded.** The API returns *URLs* (a playback manifest of mirror
  URLs), never binary blobs. A client resolves a URL and streams it — possibly from a **different
  host** than the API, via the [mirror registry](./federation-mirrors.md). So "the media" isn't
  locked behind one server: the local mirror serves from disk, an R2/CDN or GitHub-raw mirror can
  serve the same file, and clients pick per availability + user preference.
- **The contract is the boundary.** Clients couple to the JSON shapes and URL patterns, nothing
  else. That's what lets clients be swapped or added (the whole reason for this doc's edit) without
  touching the backend.
- **No SSR / templating in the backend.** Any web rendering is the frontend's job. The backend stays
  a pure API + file server, which is exactly what keeps it consumable by non-web clients.

> Practically for the migration: build `/api/v1` + `/media/*` first (Stages 2–5) so the React app
> reaches parity, but keep services UI-agnostic so the OpenSubsonic `/rest/` adapter (Stage 7) and
> any future native client drop in on top of the same core. **TODO/refine:** decide how far the
> OpenSubsonic method set goes (auth, browsing, streaming, playlists) and whether a separate
> read-only public API key model is wanted for third-party clients.

## Engineering principle: least libraries, native, simple

A standing rule for the backend: **depend on the Node standard library and nothing else at runtime.**
Every dependency is a future breakage — major-version churn, transitive CVEs, native-binary/OS
mismatches (we already hit that with Prisma's engine binaries). So we keep it native:

- HTTP: `node:http` + a tiny hand-written router (no framework)
- Data: `node:sqlite` + raw SQL (no ORM)
- Auth: `node:crypto` (scrypt hashing, random tokens — no bcrypt/argon2/JWT libs)
- Env: `node --env-file` (no dotenv) · Validation: small hand guards (no zod) · Tests: `node:test`
- Language: TypeScript compiled with `tsc` (dev-only; the single devDependency)

Target: **zero runtime dependencies.** Add one only when the standard library genuinely can't do the
job, and write down why. Details in [architecture.md](./architecture.md).

## The prime directive: drop-in parity

The frontend talks to the backend only through `src/lib/api.ts`, `src/lib/hooks.ts`, and the Vite
proxy. If the Node API matches the contract in [api-contract.md](./api-contract.md), the frontend
needs **zero** changes. Every design choice below is subordinate to that.

## Definition of done (MVP parity)

The sample rendition ("Tanam Farsooda Jaan Para") plays audio + shows video on the Companion page,
the mirror picker lists the local mirror, and availability filtering hides anything without media —
all with the **unchanged** React app.

## The carried-over bug this migration must kill

The one sample rendition shows a Play button but plays `0:00` and never starts. The catalog is
fine (the card renders, so a URL resolved); the failure is in the **media response**. Most likely,
in order: (1) `Content-Type: application/octet-stream` instead of `audio/mpeg`; (2) returning
`206 Partial Content` with no `Range` header present; (3) wrong media path → 404. See
[media-serving.md](./media-serving.md). **First acceptance test:** open
`http://localhost:8000/media/samples/tanam-farsooda/audio.mp3` directly — it must play inline.
