-- Migration: 002_work_experiences
-- Description: Create work_experiences table with embedding support
-- Created: 2026-03-30

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create work_experiences table
CREATE TABLE IF NOT EXISTS work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id UUID,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  industry TEXT,
  start_year INTEGER,
  end_year INTEGER,
  title_embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_profile FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_anonymous FOREIGN KEY (anonymous_id) REFERENCES profiles(anonymous_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_exp_user_id ON work_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_work_exp_anonymous_id ON work_experiences(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_work_exp_embedding ON work_experiences USING ivfflat (title_embedding vector_cosine_ops);

-- Add comments
COMMENT ON TABLE work_experiences IS 'User work experience records';
COMMENT ON COLUMN work_experiences.title_embedding IS 'Vector embedding for job title similarity search';

-- rollback
-- DROP TABLE IF EXISTS work_experiences CASCADE;
