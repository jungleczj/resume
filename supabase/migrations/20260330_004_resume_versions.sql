-- Migration: 004_resume_versions
-- Description: Create resume_versions table for version history
-- Created: 2026-03-30

-- Create resume_versions table
CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id UUID,
  editor_json JSONB NOT NULL,
  photo_path TEXT,
  show_photo BOOLEAN DEFAULT false,
  template_key TEXT DEFAULT 'default',
  snapshot_label TEXT,
  snapshot_jd TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_anonymous FOREIGN KEY (anonymous_id) REFERENCES profiles(anonymous_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_anonymous_id ON resume_versions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON resume_versions(created_at DESC);

-- Add comments
COMMENT ON TABLE resume_versions IS 'Resume version history with TipTap editor JSON';
COMMENT ON COLUMN resume_versions.editor_json IS 'TipTap editor content in JSON format';
COMMENT ON COLUMN resume_versions.snapshot_jd IS 'Job description used for this version';

-- rollback
-- DROP TABLE IF EXISTS resume_versions CASCADE;
