# @dervaish/api

Node backend for Dervaish — **standard library only**. `node:http` for the server, `node:sqlite` for
data, `node:crypto` for auth, TypeScript compiled with `tsc`. **Zero runtime dependencies** (the only
devDependency is `typescript`). Replaces the archived Django backend (`archive/backend-django/`,
reference spec). Design docs: `docs/node/`; migration plan + live tests: `docs/status.html`.

## Requirements
**Node ≥ 22.5** (built-in `node:sqlite`). Run flags: `--experimental-sqlite`, `--env-file=.env`
(both baked into the npm scripts).

## Status: Stages 2–4 — media + schema + read/auth API
`node:http` server with `/healthz` and `/api/v1`, hand-set CORS exposing the media headers the test
harness checks. Full SQL schema in `db/schema.sql` (catalog, media, federation, users, contribution)
applied on boot by `src/db.ts`; `src/seed.ts` builds the demo catalogue and the one playable public
rendition from the bundled sample. Implemented: Range media serving (`/media/*`, 206), the catalog
reads (`/kalams`, `/renditions`, `/people`, `/collections`, `/search`), the federation directory
(`/directory/mirrors`), token auth (`/auth/*`, `/me/*`), community (`/community/requests`,
`/submissions`), and editor+ admin reads (`/admin/renders`, `/admin/review/submissions`,
`/admin/published`). Stages 5–6 (offline packages, richer contribution/video workflows) remain.

Seed first, then run:
```bash
npm run build -w @dervaish/api && npm run seed -w @dervaish/api && npm run dev -w @dervaish/api
```
Demo logins (username / password): `listener`/`listen123`, `contributor`/`contrib123`,
`editor`/`edit123`, `admin`/`admin123`.

## Run
```bash
npm install                     # installs the one devDependency (typescript)
npm run build -w @dervaish/api  # tsc → dist/
npm run dev   -w @dervaish/api  # node --experimental-sqlite --env-file=.env --watch dist/server.js
#   → http://localhost:8000
```
Dev loop without extra tooling: `npm run dev:build` (`tsc --watch`) in one terminal, `npm run dev`
in another. Verify: `curl http://localhost:8000/healthz` → `{"status":"ok",...}`, then open
`docs/status.html`, point it at `http://localhost:8000`, and run the **Stage 1** checks.

## Layout
```
apps/api/
  src/
    server.ts   node:http server + boot (Step 1)
    env.ts      reads process.env (via --env-file), resolves MEDIA_ROOT to absolute
    db.ts       opens node:sqlite, applies db/schema.sql (wired in from Stage 3)
    seed.ts     placeholder (seed_demo + seed_local_media equivalent = Stage 3)
  db/
    schema.sql  CREATE TABLE … (real §4 schema = Stage 3)
  .env          PORT=8000, MEDIA_ROOT=../../mediafiles, DB_PATH=./dervaish.db
```

## Next steps
- **Stage 2** — `GET /media/*` Range/MIME server (`node:http`+`node:fs`); prove `audio.mp3` plays inline.
- **Stage 3** — real SQL schema (`db/schema.sql`) + seed.
- **Stages 4–6** — read endpoints (`get_playback`), auth/user-scoped, contribution/admin.
