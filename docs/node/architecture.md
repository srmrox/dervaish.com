# Architecture

## Guiding principle: least libraries, native, simple

The backend depends on **the Node standard library and nothing else at runtime**. Every dependency
is a future breakage (major-version churn, transitive CVEs, native-binary/OS mismatches — we already
hit that class of problem with Prisma's engine binaries). So the rule is:

> If Node's standard library can do it, use that. Add a dependency only when the standard library
> genuinely can't, and record why.

- **Runtime dependencies: none.** Node built-ins only.
- **Dev dependencies: `typescript` only** (the compiler; dev-time, no runtime footprint).
- Prefer a little hand-written code we own over a library we don't.

## Stack

| Concern | Choice | Was (dropped) |
|---------|--------|---------------|
| HTTP server | `node:http` + a tiny hand-written router | Fastify, @fastify/cors |
| Database | `node:sqlite` (`DatabaseSync`) + raw SQL | Prisma, @prisma/client |
| Validation | small hand-written guards | zod |
| Env | `node --env-file=.env` | dotenv |
| Auth (hash/token) | `node:crypto` (scrypt, randomBytes) | bcrypt/argon2, jwt libs |
| Tests | `node:test` + `node:assert` | vitest |
| Language/build | TypeScript → `tsc` → `dist/` | tsx |
| Streaming media | `node:fs` createReadStream | @fastify/static |

Node built-ins used: `node:http`, `node:sqlite`, `node:fs`, `node:path`, `node:crypto`,
`node:stream`, `node:url`, `node:test`.

## Runtime requirements

- **Node ≥ 22.5** (that's when `node:sqlite` landed).
- Run flags: **`--experimental-sqlite`** (unlocks `node:sqlite`) and **`--env-file=.env`** (loads
  env, replaces dotenv). Both are stable CLI features; `node:sqlite`'s API is still marked
  experimental — pin the Node version and watch its release notes. **TODO/refine** as it stabilises.

## Monorepo layout

```
dervaish.com/
  apps/
    platform-web/   React frontend (unchanged)
    api/            ← this backend
      src/
        server.ts   node:http server + boot
        router.ts   tiny method+path router (params, query, body parsing)
        env.ts       reads process.env, resolves MEDIA_ROOT to absolute
        db.ts        opens node:sqlite, applies db/schema.sql, exposes prepared queries
        http.ts      helpers: json(), paginate(), cors(), notFound(), readBody()
        routes/      one module per resource (kalams, renditions, media, auth, …)
        services/    catalog queries, mirror resolver, get_playback, has_media
        serializers/ pure (row) → contract JSON functions
        seed.ts      seed_demo + seed_local_media equivalents (raw INSERTs)
      db/
        schema.sql   CREATE TABLE … (the whole schema; see data-model.md)
      .env           PORT=8000, MEDIA_ROOT=../../mediafiles, DB_PATH=./dervaish.db
  mediafiles/       MEDIA_ROOT, served by GET /media/*
  archive/backend-django/   reference spec
```

## Request lifecycle

```
node:http request
  → cors(): set Access-Control-* incl. Expose-Headers: Content-Range, Accept-Ranges, Content-Length
            (answer OPTIONS preflight with 204)
  → router: match METHOD + path → handler (+ path params, parsed query)
  → auth: if "Authorization: Token <t>", look up token in SQLite → attach ctx.user (else anonymous)
  → handler: validate (hand guards) → SQL query via db.ts → serializer → json()/paginate()
  → for /media/*: stream the file with Range support (see media-serving.md)
```

## Layers (kept separate, all hand-written)

1. **Router / http helpers** — parse method, path, query, body; format JSON + pagination; CORS. Thin
   plumbing over `node:http`. One small file, no framework.
2. **Routes** — HTTP only: read params, call a service, format the reply.
3. **Services** — business logic: SQL queries, the mirror resolver, `get_playback`, `has_media`,
   `apply_submission`. Pure functions over `db.ts`; unit-testable with `node:test`.
4. **Serializers** — pure `(row) → contract JSON`. These ARE the contract; keep them faithful to
   `archive/backend-django/catalog/serializers.py`.
5. **db.ts** — opens the SQLite database, applies `db/schema.sql`, hands out prepared statements.

## Data access with `node:sqlite`

```ts
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { env } from "./env.js";

export const db = new DatabaseSync(env.DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")); // idempotent CREATE IF NOT EXISTS

// prepared statements are reused; .get() one row, .all() many, .run() write
export const q = {
  kalamBySlug: db.prepare("SELECT * FROM kalam WHERE slug = ?"),
  publicKalams: db.prepare("SELECT * FROM kalam WHERE visibility IN ('public','unlisted') ORDER BY title LIMIT ? OFFSET ?"),
};
```

JSON columns (`translations`, `tags`, `preferences`, …) are stored as TEXT and `JSON.parse`d in the
serializer; SQLite's built-in JSON functions are available if you ever need to query into them.

## Conventions carried from Django

- **Base path** `/api/v1` for the app/data API. `/media/*`, `/rest/*` (Subsonic), `/healthz` are
  **top-level**.
- **Pagination**: every list endpoint returns `{ count, next, previous, results[] }` — built by a
  hand-written `paginate()` helper.
- **Two separate enums**: `Visibility` (has `public`) vs `EditorialState` (has `published`). Modelled
  as `TEXT` columns with `CHECK` constraints — see [data-model.md](./data-model.md).
- **Public catalog filter**: `visibility IN ('public','unlisted')` in the SQL.

## Config / env

`node --env-file=.env` loads `.env`; `src/env.ts` reads `process.env` with defaults and a couple of
hand guards (throw on missing/invalid), then resolves `MEDIA_ROOT` to absolute.

| Key | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8000` | keep 8000 so the Vite proxy needs no change |
| `HOST` | `0.0.0.0` | |
| `MEDIA_ROOT` | `../../mediafiles` | resolved to absolute from the `apps/api` dir |
| `DB_PATH` | `./dervaish.db` | SQLite file path |

## On keeping it native as the app grows

- **Migrations** — plain numbered `.sql` files in `db/migrations/` applied in order by a ~20-line
  runner that records applied versions in a `schema_migrations` table. No migration library.
- **Background jobs (Stage 7)** — prefer a SQLite `job` table polled by a worker (or
  `node:worker_threads`) over BullMQ + Redis, to stay dependency-free. **TODO/refine.**
- **Postgres?** `node:sqlite` is SQLite-only. Sticking with SQLite in prod (WAL + a file backup /
  litestream) keeps us at zero DB libraries. Moving to Postgres would add the `pg` dependency — an
  explicit, deliberate trade, not a default. **TODO/refine.**
