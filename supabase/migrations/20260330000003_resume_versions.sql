-- ============================================
-- Migration: 20260330000003_resume_versions.sql
-- Description: Resume versions table
-- Created: 2026-03-30
-- ============================================

CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  upload_id UUID REFERENCES resume_uploads(id) ON DELETE SET NULL,
  editor_json JSONB NOT NULL,
  photo_path TEXT,
  show_photo BOOLEAN DEFAULT false,
  template_key TEXT DEFAULT 'default',
  snapshot_label TEXT,
  snapshot_jd TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_anonymous_id ON resume_versions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON resume_versions(created_at DESC);
COMMENT ON TABLE resume_versions IS 'Resume version snapshots';

-- rollback
-- DROP TABLE IF EXISTS resume_versions;
