-- Apply only to a separately provisioned Sushi Showdown database.
CREATE TABLE rooms (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  host_token_hash text NOT NULL,
  host_participant_id text NOT NULL,
  owner_user_id text,
  created_at bigint NOT NULL
);
CREATE TABLE participants (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL,
  room_id text REFERENCES rooms(id),
  participant_token_hash text,
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0),
  version bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  UNIQUE (room_id, name_key)
);
CREATE TABLE score_operations (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES participants(id),
  delta integer NOT NULL CHECK (delta IN (-1, 1)),
  applied integer NOT NULL DEFAULT 0 CHECK (applied IN (0, 1))
);
CREATE TABLE emote_events (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES participants(id),
  emoji text NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX idx_emotes_created_at ON emote_events(created_at);
CREATE INDEX idx_emotes_participant_time ON emote_events(participant_id,created_at);
CREATE TABLE participant_access (
  token_hash text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES participants(id),
  created_at bigint NOT NULL
);
