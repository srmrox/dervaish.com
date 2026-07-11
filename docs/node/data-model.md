# Data model (SQL / `node:sqlite`)

The schema is plain **SQLite DDL** in `apps/api/db/schema.sql`, applied on boot by `db.ts` (all
`CREATE TABLE IF NOT EXISTS`, so it's idempotent). No ORM, no schema-definition library — the SQL is
the schema. Field names match what the **API serializes** (the frontend depends on them); column
names are `snake_case` and map 1:1 to the JSON keys.

Translated from `archive/backend-django/*/models.py`.

## SQLite conventions used here

- **Enums** → `TEXT` with a `CHECK (col IN (...))` constraint. The allowed values are listed per
  field below. (No native enum type; the CHECK keeps the DB honest, app code validates on the way in.)
- **JSON** (`translations`, `meaning`, `external_ids`, `preferences`, `aliases`, `tags`) → `TEXT`
  holding a JSON string, `JSON.parse`d in the serializer. Default `'{}'` or `'[]'`.
- **Booleans** → `INTEGER` `0`/`1`.
- **Timestamps** → `TEXT` ISO-8601 (`created_at`, `updated_at`) with `DEFAULT (datetime('now'))`.
- **FKs** → `INTEGER REFERENCES parent(id)`; `PRAGMA foreign_keys = ON`.
- **M2M** → explicit join tables.

## Enums (as CHECK value sets)

```
visibility       : draft | pending | public | unlisted | archived     -- what is shown
editorial_state  : draft | in_review | published | rejected           -- review workflow (separate!)
protection_level : open | signed | drm
person_role      : author | reciter | composer | translator | contributor
media_kind       : audio | video
processing_status: ready | ...            -- confirm full set from media/models.py
mirror_kind      : r2 | cdn | github | external | local
source_kind      : official | community | personal
user_role        : listener | contributor | editor | admin            -- (anonymous = no token)
```

> **Visibility vs editorial_state is the #1 gotcha.** Visibility (has `public`) drives what's shown;
> editorial_state (has `published`, no `public`) drives review. Different columns, different values.

## `db/schema.sql` — core catalog

```sql
-- ---- taxonomy ----
CREATE TABLE IF NOT EXISTS vocabulary_term (
  id    INTEGER PRIMARY KEY,
  kind  TEXT NOT NULL,            -- language | genre | tradition | era | theme | region
  label TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE
);

-- ---- people ----
CREATE TABLE IF NOT EXISTS person (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  name_native    TEXT NOT NULL DEFAULT '',
  aliases        TEXT NOT NULL DEFAULT '[]',     -- JSON array
  biography      TEXT NOT NULL DEFAULT '',
  era            TEXT NOT NULL DEFAULT '',
  region         TEXT NOT NULL DEFAULT '',
  tradition_id   INTEGER REFERENCES vocabulary_term(id),
  external_ids   TEXT NOT NULL DEFAULT '{}',     -- JSON object
  visibility     TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','pending','public','unlisted','archived')),
  state          TEXT NOT NULL DEFAULT 'draft'  CHECK (state IN ('draft','in_review','published','rejected')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- kalam (the work) ----
CREATE TABLE IF NOT EXISTS kalam (
  id                    INTEGER PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE,
  title                 TEXT NOT NULL,
  title_native          TEXT NOT NULL DEFAULT '',
  title_transliterated  TEXT NOT NULL DEFAULT '',
  summary               TEXT NOT NULL DEFAULT '',
  author_id             INTEGER REFERENCES person(id),
  primary_language_id   INTEGER REFERENCES vocabulary_term(id),  -- kind=language
  genre_id              INTEGER REFERENCES vocabulary_term(id),  -- kind=genre
  tradition_id          INTEGER REFERENCES vocabulary_term(id),  -- kind=tradition
  era                   TEXT NOT NULL DEFAULT '',
  tags                  TEXT NOT NULL DEFAULT '[]',              -- JSON array
  published_at          TEXT,
  visibility            TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','pending','public','unlisted','archived')),
  state                 TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','published','rejected')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kalam_visibility ON kalam(visibility, published_at);

-- themes: M2M kalam ↔ vocabulary_term(kind=theme)
CREATE TABLE IF NOT EXISTS kalam_theme (
  kalam_id INTEGER NOT NULL REFERENCES kalam(id) ON DELETE CASCADE,
  term_id  INTEGER NOT NULL REFERENCES vocabulary_term(id) ON DELETE CASCADE,
  PRIMARY KEY (kalam_id, term_id)
);

CREATE TABLE IF NOT EXISTS verse (
  id              INTEGER PRIMARY KEY,
  kalam_id        INTEGER NOT NULL REFERENCES kalam(id) ON DELETE CASCADE,
  "order"         INTEGER NOT NULL DEFAULT 0,
  text_native     TEXT NOT NULL DEFAULT '',
  transliteration TEXT NOT NULL DEFAULT '',
  translations    TEXT NOT NULL DEFAULT '{}',   -- {"en":"…","ur":"…"}
  meaning         TEXT NOT NULL DEFAULT '{}',   -- {"en":"…"}
  UNIQUE (kalam_id, "order")
);

-- ---- rendition (a performance) ----
CREATE TABLE IF NOT EXISTS rendition (
  id               INTEGER PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  kalam_id         INTEGER NOT NULL REFERENCES kalam(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT '',
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  year             INTEGER,
  album            TEXT NOT NULL DEFAULT '',
  publisher        TEXT NOT NULL DEFAULT '',
  style            TEXT NOT NULL DEFAULT '',
  protection_level TEXT NOT NULL DEFAULT 'open' CHECK (protection_level IN ('open','signed','drm')),
  rights_note      TEXT NOT NULL DEFAULT '',
  published_at     TEXT,
  visibility       TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','pending','public','unlisted','archived')),
  state            TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','published','rejected')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rendition_visibility ON rendition(visibility, published_at);

-- rendition ↔ media_asset (M2M)
CREATE TABLE IF NOT EXISTS rendition_asset (
  rendition_id INTEGER NOT NULL REFERENCES rendition(id) ON DELETE CASCADE,
  asset_id     INTEGER NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  PRIMARY KEY (rendition_id, asset_id)
);

-- ---- credits (typed person ↔ kalam/rendition) ----
CREATE TABLE IF NOT EXISTS credit (
  id            INTEGER PRIMARY KEY,
  person_id     INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('author','reciter','composer','translator','contributor')),
  kalam_id      INTEGER REFERENCES kalam(id) ON DELETE CASCADE,
  rendition_id  INTEGER REFERENCES rendition(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  note          TEXT NOT NULL DEFAULT ''
);

-- ---- collections / library / queues ----
CREATE TABLE IF NOT EXISTS collection (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_curated  INTEGER NOT NULL DEFAULT 0,
  owner_id    INTEGER REFERENCES user(id),
  visibility  TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','pending','public','unlisted','archived')),
  state       TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','published','rejected'))
);
CREATE TABLE IF NOT EXISTS collection_item (
  id            INTEGER PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
  rendition_id  INTEGER NOT NULL REFERENCES rendition(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (collection_id, rendition_id)
);
CREATE TABLE IF NOT EXISTS saved_item (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  rendition_id INTEGER NOT NULL REFERENCES rendition(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, rendition_id)
);
CREATE TABLE IF NOT EXISTS queue (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Up Next',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS queue_item (
  id           INTEGER PRIMARY KEY,
  queue_id     INTEGER NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
  rendition_id INTEGER NOT NULL REFERENCES rendition(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (queue_id, rendition_id)
);
```

### Taxonomy note
Django emits the term's **`label`** (a plain string) for `primary_language`/`genre`/`tradition`, and
an array of labels for `themes`. Keep FK ids internally, `JOIN vocabulary_term` in the serializer to
emit the label(s). e.g. `genre: "Naat"`, `themes: ["love","longing"]`.

## `db/schema.sql` — media plane

```sql
CREATE TABLE IF NOT EXISTS media_asset (
  id                INTEGER PRIMARY KEY,
  storage_key       TEXT NOT NULL UNIQUE,     -- "samples/tanam-farsooda/audio.mp3"
  kind              TEXT NOT NULL CHECK (kind IN ('audio','video')),
  mime_type         TEXT NOT NULL,
  original_filename TEXT NOT NULL DEFAULT '',
  size_bytes        INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'ready',
  source_name       TEXT NOT NULL DEFAULT '',
  source_url        TEXT NOT NULL DEFAULT '',  -- external/GitHub original (directly playable)
  height            INTEGER
);
CREATE TABLE IF NOT EXISTS media_variant (      -- an encoding of an asset (Django MediaRendition)
  id                  INTEGER PRIMARY KEY,
  asset_id            INTEGER NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  storage_key         TEXT NOT NULL,
  container           TEXT NOT NULL,            -- "mp3" | "mp4" | …
  url                 TEXT NOT NULL DEFAULT '',
  bitrate_kbps        INTEGER,
  height              INTEGER,
  is_streaming        INTEGER NOT NULL DEFAULT 1,
  is_offline_download INTEGER NOT NULL DEFAULT 0,
  processing_status   TEXT NOT NULL DEFAULT 'ready'
);
```

## `db/schema.sql` — federation (behaviour in federation-mirrors.md)

```sql
CREATE TABLE IF NOT EXISTS content_source (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'community' CHECK (kind IN ('official','community','personal')),
  is_official INTEGER NOT NULL DEFAULT 0,
  is_default  INTEGER NOT NULL DEFAULT 0,
  is_enabled  INTEGER NOT NULL DEFAULT 1,
  verified    INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS media_mirror (
  id                 INTEGER PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  base_url           TEXT NOT NULL,             -- local mirror = "/media/"
  kind               TEXT NOT NULL DEFAULT 'cdn' CHECK (kind IN ('r2','cdn','github','external','local')),
  is_official        INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,  -- admin kill-switch
  is_default_enabled INTEGER NOT NULL DEFAULT 1,
  verified           INTEGER NOT NULL DEFAULT 0,
  carries_all        INTEGER NOT NULL DEFAULT 0,  -- assumed to host everything
  priority           INTEGER NOT NULL DEFAULT 100 -- lower = preferred
);
CREATE TABLE IF NOT EXISTS media_asset_mirror (
  id           INTEGER PRIMARY KEY,
  asset_id     INTEGER NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  mirror_id    INTEGER NOT NULL REFERENCES media_mirror(id) ON DELETE CASCADE,
  available    INTEGER NOT NULL DEFAULT 1,
  url_override TEXT NOT NULL DEFAULT '',
  UNIQUE (asset_id, mirror_id)
);
```

`url_for(base_url, storage_key)` = `base_url.replace(/\/+$/,'') + '/' + storage_key.replace(/^\/+/,'')`
— a two-line helper, no library.

## `db/schema.sql` — user + auth

```sql
CREATE TABLE IF NOT EXISTS user (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- scrypt: "salt:hash" (node:crypto) — see auth-users.md
  role          TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('listener','contributor','editor','admin')),
  trust_score   INTEGER NOT NULL DEFAULT 0,
  display_name  TEXT NOT NULL DEFAULT '',
  preferences   TEXT NOT NULL DEFAULT '{}', -- client-owned JSON blob
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_token (      -- opaque tokens (node:crypto randomBytes)
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Role ranking for permission checks (in code, not SQL):
`listener(1) < contributor(2) < editor(3) < admin(4)`.

## Contribution / content / video (sketch — mirror the archived models)

Reproduce as more `CREATE TABLE`s before Stage 6; can be **stubbed** until then (see
[contribution-admin.md](./contribution-admin.md)). Entities: `submission`, `kalam_request` +
`request_upvote`, `annotation`, `published_file`, `video_generation_job`. **TODO/refine:** read
`archive/backend-django/{community,content,video_generation}/models.py` for exact fields.

## Migrations

`db/schema.sql` is the current shape (idempotent). Once there's real data to preserve, switch to
numbered files `db/migrations/0001_*.sql`, `0002_*.sql`, … applied in order by a tiny runner that
records applied versions in a `schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT)` table.
No migration library. **TODO/refine** when the schema first changes against live data.
