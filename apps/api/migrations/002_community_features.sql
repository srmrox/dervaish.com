CREATE TABLE IF NOT EXISTS track_requests (
  id text PRIMARY KEY,
  title text NOT NULL,
  track_id text,
  reciter_name text,
  writer_name text,
  notes text,
  requester_user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'planned', 'fulfilled', 'rejected')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS track_request_votes (
  request_id text NOT NULL REFERENCES track_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE IF NOT EXISTS track_votes (
  track_id text NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (track_id, user_id)
);

CREATE TABLE IF NOT EXISTS submission_verifications (
  id text PRIMARY KEY,
  submission_id text NOT NULL,
  verifier_user_id text NOT NULL,
  field text NOT NULL CHECK (field IN ('writer', 'reciter', 'lyrics', 'source', 'overall')),
  vote text NOT NULL CHECK (vote IN ('verify', 'dispute')),
  note text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (submission_id, verifier_user_id, field)
);

CREATE INDEX IF NOT EXISTS track_requests_status_idx ON track_requests (status);
CREATE INDEX IF NOT EXISTS track_request_votes_request_idx ON track_request_votes (request_id);
CREATE INDEX IF NOT EXISTS track_votes_track_idx ON track_votes (track_id);
CREATE INDEX IF NOT EXISTS submission_verifications_submission_idx ON submission_verifications (submission_id);
