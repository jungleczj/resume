-- ============================================
-- Migration: 20260330000005_notion_tables.sql
-- Description: Notion integration tables
-- Created: 2026-03-30
-- ============================================

CREATE TABLE IF NOT EXISTS notion_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_connections_user_id ON notion_connections(user_id);
COMMENT ON TABLE notion_connections IS 'Notion workspace connections';

CREATE TABLE IF NOT EXISTS notion_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES notion_connections(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'beautifying', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_jobs_user_id ON notion_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_jobs_status ON notion_sync_jobs(status);
COMMENT ON TABLE notion_sync_jobs IS 'Notion sync job tracking';

-- rollback
-- DROP TABLE IF EXISTS notion_sync_jobs;
-- DROP TABLE IF EXISTS notion_connections;
