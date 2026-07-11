-- Dervaish schema (Stage 3). Plain SQLite DDL, applied idempotently on boot by
-- src/db.ts. Column names are snake_case and map 1:1 to the JSON the API emits
-- (the frontend depends on them — see apps/platform-web/src/lib/types.ts and
-- docs/node/data-model.md). No ORM: the SQL is the schema.
--
-- Conventions: enums = TEXT + CHECK; JSON = TEXT (parsed in the serializer);
-- booleans = INTEGER 0/1; timestamps = TEXT ISO-8601; FKs = INTEGER REFERENCES.
-- Tables are ordered so every REFERENCES target is created first.

-- Migration bookkeeping.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- taxonomy ----
CREATE TABLE IF NOT EXISTS vocabulary_term (
  id    INTEGER PRIMARY KEY,
  kind  TEXT NOT NULL,            -- language | genre | tradition | era | theme | region
  label TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE
);

-- ---- user + auth ----
CREATE TABLE IF NOT EXISTS user (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- scrypt "salt:hash" (node:crypto)
  role          TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('listener','contributor','editor','admin')),
  trust_score   INTEGER NOT NULL DEFAULT 0,
  display_name  TEXT NOT NULL DEFAULT '',
  preferences   TEXT NOT NULL DEFAULT '{}', -- client-owned JSON blob
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_token (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  primary_language_id   INTEGER REFERENCES vocabulary_term(id),
  genre_id              INTEGER REFERENCES vocabulary_term(id),
  tradition_id          INTEGER REFERENCES vocabulary_term(id),
  era                   TEXT NOT NULL DEFAULT '',
  tags                  TEXT NOT NULL DEFAULT '[]',              -- JSON array
  published_at          TEXT,
  visibility            TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft','pending','public','unlisted','archived')),
  state                 TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','in_review','published','rejected')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kalam_visibility ON kalam(visibility, published_at);

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
  start_ms        INTEGER,                       -- synced-lyric cue start (ms), nullable
  end_ms          INTEGER,                       -- synced-lyric cue end (ms), nullable
  UNIQUE (kalam_id, "order")
);

-- ---- media plane ----
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
CREATE TABLE IF NOT EXISTS media_variant (
  id                  INTEGER PRIMARY KEY,
  asset_id            INTEGER NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  storage_key         TEXT NOT NULL,
  container           TEXT NOT NULL,
  url                 TEXT NOT NULL DEFAULT '',
  bitrate_kbps        INTEGER,
  height              INTEGER,
  is_streaming        INTEGER NOT NULL DEFAULT 1,
  is_offline_download INTEGER NOT NULL DEFAULT 0,
  processing_status   TEXT NOT NULL DEFAULT 'ready'
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

-- ---- federation ----
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
  base_url           TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'cdn' CHECK (kind IN ('r2','cdn','github','external','local')),
  is_official        INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  is_default_enabled INTEGER NOT NULL DEFAULT 1,
  verified           INTEGER NOT NULL DEFAULT 0,
  carries_all        INTEGER NOT NULL DEFAULT 0,
  priority           INTEGER NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS media_asset_mirror (
  id           INTEGER PRIMARY KEY,
  asset_id     INTEGER NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  mirror_id    INTEGER NOT NULL REFERENCES media_mirror(id) ON DELETE CASCADE,
  available    INTEGER NOT NULL DEFAULT 1,
  url_override TEXT NOT NULL DEFAULT '',
  UNIQUE (asset_id, mirror_id)
);

-- ---- contribution / community / admin ----
CREATE TABLE IF NOT EXISTS submission (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'source' CHECK (kind IN ('source','transcription','timing','translation','context')),
  payload       TEXT NOT NULL DEFAULT '{}',    -- JSON
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_review','changes_requested','accepted','rejected','applied')),
  reviewer_note TEXT NOT NULL DEFAULT '',
  author_id     INTEGER REFERENCES user(id) ON DELETE SET NULL,
  author_name   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS kalam_request (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  details      TEXT NOT NULL DEFAULT '',
  author_hint  TEXT NOT NULL DEFAULT '',
  reciter_hint TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','fulfilled','rejected')),
  created_by_id INTEGER REFERENCES user(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS request_upvote (
  request_id INTEGER NOT NULL REFERENCES kalam_request(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (request_id, user_id)
);
CREATE TABLE IF NOT EXISTS published_file (
  id           INTEGER PRIMARY KEY,
  entity_type  TEXT NOT NULL DEFAULT '',
  entity_id    TEXT NOT NULL DEFAULT '',
  repo_path    TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  commit_sha   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','failed')),
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS video_generation_job (
  id                     INTEGER PRIMARY KEY,
  rendition_id           INTEGER REFERENCES rendition(id) ON DELETE SET NULL,
  source_mode            TEXT NOT NULL DEFAULT 'audio_visualizer' CHECK (source_mode IN ('audio_visualizer','video_overlay')),
  layout_id              TEXT NOT NULL DEFAULT '',
  resolution             TEXT NOT NULL DEFAULT '1080p',
  visible_language_codes TEXT NOT NULL DEFAULT '[]',  -- JSON array
  title                  TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  output_url             TEXT NOT NULL DEFAULT '',
  failure_reason         TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
