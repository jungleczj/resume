-- Migration: 20260405000002_error_logs.sql
-- Description: Add error_logs table for backend error tracking
-- Created: 2026-04-05

CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  context     TEXT NOT NULL,          -- e.g. 'parse', 'upload', 'generate', 'export'
  error_msg   TEXT NOT NULL,
  stack       TEXT,
  anonymous_id TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upload_id   UUID,
  meta        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_error_logs_context    ON error_logs(context);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_anonymous  ON error_logs(anonymous_id);

-- Service role can insert/read; anon has no access
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON error_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- rollback
-- DROP TABLE IF EXISTS error_logs;
