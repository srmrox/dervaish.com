CREATE TABLE IF NOT EXISTS lyric_preferences (
  user_id text NOT NULL,
  track_id text NOT NULL,
  visible_language_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS media_libraries (
  id text PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('github', 'external', 'storage')),
  base_url text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS media_mirrors (
  id text PRIMARY KEY,
  library_id text NOT NULL REFERENCES media_libraries(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('audio', 'video', 'image')),
  format text CHECK (format IN ('flac', 'opus', 'aac', 'webm', 'mp4', 'mkv', 'mp3', 'wav', 'jpg', 'png')),
  source_url text NOT NULL,
  playback_url text,
  url_source text CHECK (url_source IN ('storage', 'external', 'github')),
  checksum_sha256 text,
  is_available boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS correction_for_track_id text;
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS correction_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS lyric_preferences_user_idx ON lyric_preferences (user_id);
CREATE INDEX IF NOT EXISTS media_mirrors_track_idx ON media_mirrors (track_id);
CREATE INDEX IF NOT EXISTS media_mirrors_library_idx ON media_mirrors (library_id);
