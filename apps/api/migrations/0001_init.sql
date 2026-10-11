-- A player exists once they have a nickname. name_key is the nickname in lower case, so "Alice" and "alice" are one name.
CREATE TABLE players (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- The leaderboard order: rating, then wins.
CREATE INDEX players_by_rank ON players (rating DESC, wins DESC);

-- kind is a flag from ResultKind in src/core/game.ts: 1 a score, 2 a resignation, 4 the player to move did not move in time.
-- opponent is the uid of the other player, or null for a game against the engine.
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL REFERENCES players (uid) ON DELETE CASCADE,
  opponent TEXT,
  opponent_name TEXT NOT NULL,
  won INTEGER NOT NULL CHECK (won IN (0, 1)),
  kind INTEGER NOT NULL CHECK (kind IN (1, 2, 4)),
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);

CREATE INDEX games_by_player ON games (uid, finished_at DESC);

-- The rooms that can still be joined, for the lobby. The game itself lives in the room's Durable Object.
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  host_uid TEXT NOT NULL,
  host_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX rooms_by_age ON rooms (created_at DESC);

-- A player has at most one open room, so a script cannot fill the lobby.
CREATE UNIQUE INDEX rooms_one_per_host ON rooms (host_uid);
