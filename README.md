# Dervaish

Dervaish is a preservation-focused devotional media archive and listening platform —
Naat, Hamd, and Sufi *kalam*, presented with original script, transliteration, and
translation, with synced ("Companion") lyrics, credits, collections, community
verification, and federated media mirrors.

The active implementation is a small npm workspace monorepo:

- **`apps/api`** (`@dervaish/api`): the backend — **zero runtime dependencies**, built on
  Node's standard library (`node:http` for the server, `node:sqlite` for data,
  `node:crypto` for auth). TypeScript compiled with `tsc`.
- **`apps/platform-web`** (`@dervaish/platform-web`): the web client — React + Vite,
  React Router, and TanStack Query, talking to the API over `/api/v1`.

The previous Django/DRF/Celery/PostgreSQL backend and the React Native app have been
retired. The Django code is kept under **`archive/backend-django/`** as the reference
spec for the port. Design docs live in `docs/` (`docs/node/` documents the Node backend).

Requires **Node ≥ 22.5** (for built-in `node:sqlite`).

## Quick start

Install workspace dependencies from the repository root:

```bash
npm install
```

Build, seed, and run the **API** (`http://localhost:8000`):

```bash
npm run build -w @dervaish/api   # tsc → apps/api/dist
npm run seed  -w @dervaish/api   # apply db/schema.sql + seed the demo catalogue
npm run dev:api                  # node --experimental-sqlite --watch dist/server.js
```

Run the **web** app (`http://localhost:5174`) in another terminal:

```bash
npm run dev:web
```

The Vite dev server proxies `/api`, `/rest`, `/media`, and `/healthz` to the API on
`:8000`, so the browser only ever talks to `:5174` (no CORS in dev). For a hosted API,
set `VITE_DERVAISH_API_BASE_URL`.

Demo logins seeded by `seed` (username / password):
`listener`/`listen123`, `contributor`/`contrib123`, `editor`/`edit123`, `admin`/`admin123`.

## Media samples

`mediafiles/` is **not committed** — the large audio/video samples live in the separate
`dervaish-media` repo (playback is normalized to mirror URLs). To play the local demo
end to end, place the sample files under `mediafiles/samples/tanam-farsooda/`:

```
audio.mp3  landscape-1080p.mp4  portrait-1080p.mp4  lyrics.json
```

then re-run `npm run build -w @dervaish/api && npm run seed -w @dervaish/api`. The seed
reads `lyrics.json` for the title, reciter, and per-line timings used by the synced
Companion; renditions without available media render as "unavailable" rather than failing.

## API surface

Base path `/api/v1`; lists are paginated (`{ count, next, previous, results }`); public
surfaces filter to `visibility in (public, unlisted)`. See `docs/node/api-contract.md`.

- **Catalog (read):** `/kalams`, `/kalams/:slug`, `/renditions/:slug`, `/people`,
  `/people/:slug`, `/collections`, `/collections/:slug`, `/search?q=`
- **Federation:** `/directory/mirrors`, `/directory/sources`
- **Auth + user:** `/auth/{register,login,logout}`, `/me`, `/me/preferences`,
  `/me/library`, `/me/queues`
- **Community:** `/community/requests` (+ `/:id/upvote`), `/submissions`
- **Admin (editor+):** `/admin/renders`, `/admin/review/submissions` (+ review/apply),
  `/admin/published`
- **Media:** `/media/*` — Range-capable static serving (HTTP 206) for streaming.

Health check: `GET /healthz`.

## Build & typecheck

```bash
npm run build       # build all workspaces
npm run typecheck   # typecheck all workspaces
```

## Browser QA

Install Playwright Chromium once, then run the smoke suite with both servers up:

```bash
npx playwright install chromium
npm run test:e2e -w @dervaish/platform-web
```

The suite covers first paint, workflow navigation, sticky playback controls, RTL/LTR
lyric rendering, and empty/operational states.

## Design and architecture

- `docs/node/` — the Node backend: `data-model.md`, `api-contract.md`, `seeding.md`,
  `media-serving.md`, `federation-mirrors.md`, `auth-users.md`, `local-dev.md`.
- `docs/plan.md` — architecture and phased plan.
- `docs/design-system.md` — UI and workflow design rules.
- `archive/backend-django/` — the retired Django backend, kept for reference.
