-- Unknown Signal player persistence
-- Project A (HonorBase): esoogmdwzcarvlodwbue
-- Run via Supabase dashboard SQL editor or: supabase db push
-- All tables prefixed us_ (Unknown Signal namespace)

-- ──────────────────────────────────────────────────────────
-- Players: one row per unique player token
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_players (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_token  text        UNIQUE NOT NULL,
  contact_id     text,
  self_label     text        DEFAULT '',
  is_npc         boolean     DEFAULT false,
  notify_email   text,
  session_count  integer     DEFAULT 0,
  last_played_at timestamptz,
  created_at     timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- Player profiles: cross-session history + behavioral model
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_player_profiles (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid        REFERENCES us_players(id) ON DELETE CASCADE,
  contact_token       text        UNIQUE NOT NULL,
  cumulative_decisions jsonb      DEFAULT '[]'::jsonb,
  session_summaries   jsonb       DEFAULT '[]'::jsonb,
  idle_events         jsonb       DEFAULT '[]'::jsonb,
  echo_quests         jsonb       DEFAULT '[]'::jsonb,
  behavioral_model    jsonb       DEFAULT '{}'::jsonb,
  trait_totals        jsonb       DEFAULT '{}'::jsonb,
  updated_at          timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- Sessions: one row per play session
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_sessions (
  id             text        PRIMARY KEY,
  player_id      uuid        REFERENCES us_players(id) ON DELETE SET NULL,
  contact_token  text        NOT NULL,
  started_at     timestamptz DEFAULT now(),
  ended_at       timestamptz,
  summary        text,
  story_arc      text,
  dominant_tone  text,
  exchange_count integer     DEFAULT 0,
  metadata       jsonb       DEFAULT '{}'::jsonb
);

-- ──────────────────────────────────────────────────────────
-- Conversation turns: every exchange, forever
-- The raw material for behavioral modeling and cross-session memory.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_conversation_turns (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id               uuid        REFERENCES us_players(id) ON DELETE CASCADE,
  session_id              text        REFERENCES us_sessions(id) ON DELETE SET NULL,
  contact_token           text        NOT NULL,
  turn_number             integer     NOT NULL DEFAULT 0,
  player_input            text        NOT NULL,
  echo_replies            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  state_changes           jsonb       DEFAULT '{}'::jsonb,
  narrative_updates       jsonb,
  trait_snapshot          jsonb,
  scene                   text,
  behavioral_observation  text,
  created_at              timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- World state: single shared row (mirrors KV signal:world:state)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS us_world_state (
  id         integer     PRIMARY KEY DEFAULT 1,
  state      jsonb       DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT us_world_state_single_row CHECK (id = 1)
);

-- ──────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_us_turns_player   ON us_conversation_turns(player_id);
CREATE INDEX IF NOT EXISTS idx_us_turns_session  ON us_conversation_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_us_turns_token    ON us_conversation_turns(contact_token);
CREATE INDEX IF NOT EXISTS idx_us_sessions_player ON us_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_us_sessions_token  ON us_sessions(contact_token);
CREATE INDEX IF NOT EXISTS idx_us_profiles_token  ON us_player_profiles(contact_token);
