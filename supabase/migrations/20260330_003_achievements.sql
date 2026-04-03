-- Migration: 003_achievements
-- Description: Create achievements table with tier and embedding support
-- Created: 2026-03-30

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID REFERENCES work_experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'ignored')),
  tier INTEGER CHECK (tier IN (1, 2, 3)),
  has_placeholders BOOLEAN DEFAULT false,
  ai_score DECIMAL(3,2),
  source TEXT CHECK (source IN ('upload', 'notion', 'manual')),
  notion_task_id TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_achievements_experience_id ON achievements(experience_id);
CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
CREATE INDEX IF NOT EXISTS idx_achievements_tier ON achievements(tier);
CREATE INDEX IF NOT EXISTS idx_achievements_embedding ON achievements USING ivfflat (embedding vector_cosine_ops);

-- Add comments
COMMENT ON TABLE achievements IS 'Achievement records with tier classification';
COMMENT ON COLUMN achievements.tier IS 'Achievement tier: 1 (best), 2 (good), 3 (basic)';
COMMENT ON COLUMN achievements.embedding IS 'Vector embedding for similarity search';

-- rollback
-- DROP TABLE IF EXISTS achievements CASCADE;
