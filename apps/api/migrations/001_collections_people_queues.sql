CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY,
  title text NOT NULL,
  owner_user_id text NOT NULL,
  created_by_role text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  is_curated boolean NOT NULL DEFAULT false,
  artwork_url text NOT NULL,
  year integer,
  track_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS queues (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
  id text PRIMARY KEY,
  queue_id text NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  position integer NOT NULL,
  added_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS collections_visibility_idx ON collections (visibility);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON collections (owner_user_id);
CREATE INDEX IF NOT EXISTS queues_owner_idx ON queues (owner_user_id);
CREATE INDEX IF NOT EXISTS queue_items_queue_position_idx ON queue_items (queue_id, position);
