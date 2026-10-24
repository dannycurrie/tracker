-- Habit Metric Tracker — Supabase Schema
-- Branch: 001-habit-metric-tracker | Date: 2026-04-26
-- Reconciled with the live DB: 2026-10-24 (columns, types, defaults, nullability)
--
-- Deploy via Supabase dashboard SQL editor or migration file.
--
-- Access model (live): single-tenant. There is no user_id column, no RLS, and
-- the app never signs in. Anyone holding the anon key can read and write every
-- row. See prds/009-db-lockdown.md.

-- ============================================================
-- Types
-- ============================================================

CREATE TYPE metric_type AS ENUM ('cumulative', 'timed', 'average', 'checklist');
CREATE TYPE metric_timeframe AS ENUM ('weekly', 'monthly');
CREATE TYPE metric_source AS ENUM ('user', 'apple_health');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE metrics (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT             NOT NULL CHECK (char_length(name) > 0),
  type            metric_type      NOT NULL,
  timeframe       metric_timeframe NOT NULL,
  display_order   INTEGER          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  source          metric_source    DEFAULT 'user',
  checklist_items JSONB            -- 007: ordered item labels; null unless type = 'checklist'
);

CREATE TABLE log_entries (
  id               UUID         PRIMARY KEY,
  metric_id        UUID         NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  value            NUMERIC      NOT NULL CHECK (value > 0),
  logged_at        TIMESTAMPTZ  NOT NULL,
  session_start_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
-- Not verifiable through the REST API; these are the intended indexes.

-- Period range queries: metric + logged_at is the hot path
CREATE INDEX idx_log_entries_metric_logged
  ON log_entries (metric_id, logged_at DESC);

-- Dashboard load
CREATE INDEX idx_metrics_order
  ON metrics (display_order);


-- ============================================================
-- Idempotent insert helper (offline sync)
-- ============================================================
-- Client uses ON CONFLICT DO NOTHING when uploading queued entries.
-- Example:
--   INSERT INTO log_entries (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
