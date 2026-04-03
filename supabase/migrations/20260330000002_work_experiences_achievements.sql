-- ============================================
-- Migration: 20260330000002_work_experiences_achievements.sql
-- Description: Work experiences and achievements tables
-- Created: 2026-03-30
-- ============================================

-- ============================================
-- Table 3: work_experiences
-- ============================================
CREATE TABLE IF NOT EXISTS work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  department TEXT,
  industry TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  location TEXT,
  work_type TEXT DEFAULT 'onsite',
  description TEXT,
  title_embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_experiences_user_id ON work_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experiences_anonymous_id ON work_experiences(anonymous_id);
COMMENT ON TABLE work_experiences IS 'User work experience records';

-- ============================================
-- Table 4: achievements
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  experience_id UUID REFERENCES work_experiences(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'ignored')),
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  has_placeholders BOOLEAN DEFAULT false,
  ai_score DECIMAL(3,2),
  source TEXT DEFAULT 'f1_parse',
  notion_task_id TEXT,
  original_notion_text TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_anonymous_id ON achievements(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_achievements_experience_id ON achievements(experience_id);
COMMENT ON TABLE achievements IS 'Achievement records with AI beautification tiers';
COMMENT ON COLUMN achievements.tier IS '1: Quantified, 2: Placeholder, 3: Subjective';

-- rollback
-- DROP TABLE IF EXISTS achievements;
-- DROP TABLE IF EXISTS work_experiences;
