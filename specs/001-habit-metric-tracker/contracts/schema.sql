-- Habit Metric Tracker — Supabase Schema
-- Branch: 001-habit-metric-tracker | Date: 2026-04-26
--
-- Deploy via Supabase dashboard SQL editor or migration file.
-- Anonymous auth must be enabled in Authentication > Providers.

-- ============================================================
-- Types
-- ============================================================

CREATE TYPE metric_type AS ENUM ('cumulative', 'timed', 'average');
CREATE TYPE metric_timeframe AS ENUM ('weekly', 'monthly');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE metrics (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL CHECK (char_length(name) > 0),
  type          metric_type   NOT NULL,
  timeframe     metric_timeframe NOT NULL,
  display_order INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
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

-- Period range queries: metric + logged_at is the hot path
CREATE INDEX idx_log_entries_metric_logged
  ON log_entries (metric_id, logged_at DESC);

-- Fetch all metrics for a user (dashboard load)
CREATE INDEX idx_metrics_user_order
  ON metrics (user_id, display_order);


-- ============================================================
-- Idempotent insert helper (offline sync)
-- ============================================================
-- Client uses ON CONFLICT DO NOTHING when uploading queued entries.
-- Example:
--   INSERT INTO log_entries (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
