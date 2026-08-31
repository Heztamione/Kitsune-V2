CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(24) NOT NULL,
  username_key varchar(24) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar text NOT NULL DEFAULT '',
  bio varchar(500) NOT NULL DEFAULT '',
  status varchar(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  activity varchar(128) NOT NULL DEFAULT 'Gaming on Kitsune',
  platform_role varchar(16) NOT NULL DEFAULT 'Wanderer' CHECK (platform_role IN ('Wanderer', 'Admin', 'Tenko')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent varchar(512),
  ip varchar(64)
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  icon text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES users(id),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS categories_guild_idx ON categories(guild_id, position);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name varchar(100) NOT NULL,
  type varchar(16) NOT NULL CHECK (type IN ('text', 'voice', 'announcement')),
  topic varchar(1024) NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS channels_guild_idx ON channels(guild_id, position);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL DEFAULT 'Wanderer' CHECK (role IN ('Wanderer', 'Admin', 'Tenko')),
  nickname varchar(24),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS guild_members_user_idx ON guild_members(user_id);

CREATE TABLE IF NOT EXISTS guild_bans (
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES users(id),
  reason varchar(512) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content varchar(4000) NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to uuid REFERENCES messages(id) ON DELETE SET NULL,
  system boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON messages(channel_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dm_members (
  thread_id uuid NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS dm_members_user_idx ON dm_members(user_id);

CREATE TABLE IF NOT EXISTS dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content varchar(4000) NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to uuid REFERENCES dm_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_messages_thread_created_idx ON dm_messages(thread_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS friendships (
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx ON friendships(LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
