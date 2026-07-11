# Local development

## Prerequisites
**Node ≥ 22.5** (for the built-in `node:sqlite`). That's it — no runtime dependencies, SQLite is
built in, no external services. The only install is dev-time `typescript`.

## First run

```bash
# from repo root (npm workspaces) — installs the one devDependency (typescript)
npm install

# API (two terminals for dev: one compiles, one runs)
npm run build -w @dervaish/api          # tsc → dist/  (schema.sql applied on first boot)
npm run seed  -w @dervaish/api          # seed_demo + seed_local_media equivalents (raw SQL)
npm run dev:api                          # → http://localhost:8000

# Frontend (separate terminal)
npm run dev:web                          # Vite dev server, proxies to :8000
```

Dev loop without extra tooling: run `npm run dev:build -w @dervaish/api` (`tsc --watch`) in one
terminal and `npm run dev:api` (`node --watch dist/server.js`) in another — the server restarts when
`tsc` re-emits. Sanity: `curl http://localhost:8000/healthz` → `{"status":"ok",...}`.

The run scripts pass the two flags the native stack needs: **`--experimental-sqlite`** (enables
`node:sqlite`) and **`--env-file=.env`** (loads env, no dotenv).

## Ports & the Vite proxy

`apps/platform-web/vite.config.ts` proxies `/api`, `/rest`, `/media`, `/healthz` → `localhost:8000`.
**Keep the Node server on 8000** and you never touch the proxy. `src/lib/api.ts` uses relative
`/api/v1` in dev, so no frontend change is needed.

## CORS

Two situations:
- **Through the Vite proxy (normal dev):** same-origin, no CORS needed.
- **Calling the API directly / from `docs/status.html` opened as a file:** cross-origin. The API
  sets CORS headers by hand — `Access-Control-Allow-Origin` (echoes the request origin) and
  `Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length` so the media
  Range/206 checks are readable, plus a `204` answer to `OPTIONS` preflight. If you open
  `status.html` from disk and Range headers
  show as "hidden (CORS?)", serve the page same-origin (through the proxy or the Node server) or
  confirm with `curl -I`.

## Env (`apps/api/.env`)

| Key | Dev value | Notes |
|-----|-----------|-------|
| `PORT` | `8000` | matches the Vite proxy |
| `HOST` | `0.0.0.0` | |
| `MEDIA_ROOT` | `../../mediafiles` | resolved to absolute from `apps/api` |
| `DB_PATH` | `./dervaish.db` | SQLite file (opened by `node:sqlite`) |

## Gotchas (learned the hard way — see handoff §10)

- **MIME on Windows** returns `octet-stream` for `.mp3` → use the explicit map in
  [media-serving.md](./media-serving.md).
- **206 without a Range header** = duration 0 / stalled playback. Get the Range rules right.
- **PWA service worker** cached stale JS aggressively; it's a kill-switch disabled in dev
  (`apps/platform-web/public/sw.js`, registration gated to PROD in `main.tsx`). Keep it disabled in
  dev to avoid ghost bugs.

## Build (prod)

```bash
npm run build -w @dervaish/api     # tsc → dist/
npm run start -w @dervaish/api     # node --experimental-sqlite --env-file=.env dist/server.js
```
Prod stays on SQLite (WAL + a file backup / litestream) to keep zero DB dependencies; Postgres would
add `pg` and is a deliberate later trade. Deploy target (Coolify) is Stage 7 — the archived
`Dockerfile`/compose are Django-era and need revisiting for a plain Node process. **TODO/refine.**
