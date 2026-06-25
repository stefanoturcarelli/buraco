CREATE TABLE games (
  game_id    TEXT         PRIMARY KEY,
  host_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT         NOT NULL DEFAULT 'waiting'
    CONSTRAINT games_status_valid CHECK (status IN ('waiting', 'playing', 'closed')),
  players    UUID[]       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT games_max_players CHECK (cardinality(players) <= 2)
);

CREATE INDEX ON games (status);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read any game (game_id acts as a shared secret)
CREATE POLICY "games_select"
  ON games FOR SELECT TO authenticated
  USING (true);

-- A user can only create a game where they are host and first player
CREATE POLICY "games_insert"
  ON games FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = host_id
    AND (SELECT auth.uid()) = ANY(players)
  );

-- Players in the game can update it; any authenticated user can update a waiting game
-- (covers host expiring a timed-out session and a new player joining)
CREATE POLICY "games_update"
  ON games FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = ANY(players)
    OR status = 'waiting'
  )
  WITH CHECK (
    status IN ('waiting', 'playing', 'closed')
  );
