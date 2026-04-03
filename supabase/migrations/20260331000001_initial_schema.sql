-- ============================================
-- Migration: 20260331000001_initial_schema.sql
-- Description: Initial CareerFlow schema - 13 core tables
-- Author: Claude
-- Created: 2026-03-31
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 1. profiles (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_market TEXT NOT NULL DEFAULT 'cn_free' CHECK (payment_market IN ('cn_free', 'en_paid')),
  signup_geo_country TEXT,
  resume_lang_preference TEXT DEFAULT 'zh' CHECK (resume_lang_preference IN ('zh', 'en')),
  photo_path TEXT,
  photo_show_toggle BOOLEAN DEFAULT false,
  notion_access_token TEXT,
  notion_workspace_id TEXT,
  notion_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_payment_market ON profiles(payment_market);
COMMENT ON TABLE profiles IS 'User profile extending auth.users';
COMMENT ON COLUMN profiles.payment_market IS 'cn_free = free Chinese market, en_paid = paid international market';
COMMENT ON COLUMN profiles.photo_path IS 'Storage path for user photo in Supabase Storage';
COMMENT ON COLUMN profiles.photo_show_toggle IS 'Whether to show photo in resume preview';

-- ============================================
-- 2. work_experiences
-- ============================================
CREATE TABLE IF NOT EXISTS work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  industry TEXT,
  start_year INTEGER,
  end_year INTEGER,
  is_current BOOLEAN DEFAULT false,
  title_embedding vector(1536),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT work_experiences_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_work_experiences_user_id ON work_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experiences_anonymous_id ON work_experiences(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_work_experiences_title_embedding ON work_experiences USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);
COMMENT ON TABLE work_experiences IS 'User work experience records';
COMMENT ON COLUMN work_experiences.title_embedding IS 'Embedding vector for job title semantic search';

-- ============================================
-- 3. achievements
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID REFERENCES work_experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'ignored')),
  tier INTEGER CHECK (tier IN (1, 2, 3)),
  has_placeholders BOOLEAN DEFAULT false,
  ai_score NUMERIC(3, 2),
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'notion', 'manual')),
  notion_task_id TEXT,
  embedding vector(1536),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_experience_id ON achievements(experience_id);
CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
CREATE INDEX IF NOT EXISTS idx_achievements_tier ON achievements(tier);
CREATE INDEX IF NOT EXISTS idx_achievements_embedding ON achievements USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
COMMENT ON TABLE achievements IS 'Career achievement records linked to work experiences';
COMMENT ON COLUMN achievements.tier IS '1=core highlight, 2=major achievement, 3=base experience';
COMMENT ON COLUMN achievements.has_placeholders IS 'Whether the achievement text has unfilled placeholders like [X]%';
COMMENT ON COLUMN achievements.embedding IS 'Embedding vector for semantic matching with JD';

-- ============================================
-- 4. resume_versions
-- ============================================
CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  editor_json JSONB NOT NULL DEFAULT '{}',
  photo_path TEXT,
  show_photo BOOLEAN DEFAULT false,
  template_key TEXT DEFAULT 'modern_clean',
  snapshot_label TEXT,
  snapshot_jd TEXT,
  resume_lang TEXT DEFAULT 'zh' CHECK (resume_lang IN ('zh', 'en')),
  is_auto_save BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT resume_versions_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_anonymous_id ON resume_versions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON resume_versions(created_at DESC);
COMMENT ON TABLE resume_versions IS 'Resume version snapshots';
COMMENT ON COLUMN resume_versions.editor_json IS 'TipTap editor JSON state';
COMMENT ON COLUMN resume_versions.template_key IS 'Resume template identifier';

-- ============================================
-- 5. resume_uploads
-- ============================================
CREATE TABLE IF NOT EXISTS resume_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword')),
  file_size INTEGER,
  raw_text TEXT,
  photo_extracted_path TEXT,
  parse_status TEXT DEFAULT 'pending' CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed')),
  parse_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_uploads_anonymous_id ON resume_uploads(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_user_id ON resume_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_parse_status ON resume_uploads(parse_status);
COMMENT ON TABLE resume_uploads IS 'Resume file upload metadata and parse status';

-- ============================================
-- 6. paywall_settings (热更新配置)
-- ============================================
CREATE TABLE IF NOT EXISTS paywall_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market TEXT NOT NULL CHECK (market IN ('cn_free', 'en_paid')),
  is_enabled BOOLEAN DEFAULT true,
  trigger_event TEXT NOT NULL,
  price_usd NUMERIC(10, 2),
  price_cny NUMERIC(10, 2),
  payment_provider TEXT CHECK (payment_provider IN ('creem', 'stripe', 'alipay', 'wechat')),
  plan_type TEXT,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paywall_settings_market ON paywall_settings(market);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paywall_settings_market_trigger ON paywall_settings(market, trigger_event);
COMMENT ON TABLE paywall_settings IS 'Paywall configuration hot-reloadable from Supabase';

-- ============================================
-- 7. prompt_configs (AI prompt 外置)
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('cn', 'en')),
  prompt_text TEXT NOT NULL,
  model_override TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_configs_task_market_active ON prompt_configs(task, market) WHERE is_active = true;
COMMENT ON TABLE prompt_configs IS 'AI prompts stored in Supabase for hot-update without deployment';

-- ============================================
-- 8. option_libraries (成就库选项)
-- ============================================
CREATE TABLE IF NOT EXISTS option_libraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_option_libraries_category ON option_libraries(category);
COMMENT ON TABLE option_libraries IS 'Reusable option sets (industries, skills, etc.)';

-- ============================================
-- 9. ai_call_logs (AI 调用日志)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  task TEXT NOT NULL,
  model_used TEXT NOT NULL,
  is_fallback BOOLEAN DEFAULT false,
  fallback_reason TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  market TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_user_id ON ai_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_task ON ai_call_logs(task);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_created_at ON ai_call_logs(created_at DESC);
COMMENT ON TABLE ai_call_logs IS 'AI API call audit log';

-- ============================================
-- 10. analytics_events (分析埋点)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  page_path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  market TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
COMMENT ON TABLE analytics_events IS 'User behavior analytics events';

-- ============================================
-- 11. payments (支付记录)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('creem', 'stripe')),
  provider_payment_id TEXT UNIQUE,
  plan_type TEXT NOT NULL,
  amount_usd NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider, provider_payment_id);
COMMENT ON TABLE payments IS 'Payment records';

-- ============================================
-- 12. notion_sync_logs (Notion 同步日志)
-- ============================================
CREATE TABLE IF NOT EXISTS notion_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT DEFAULT 'manual' CHECK (sync_type IN ('manual', 'webhook', 'scheduled')),
  pages_synced INTEGER DEFAULT 0,
  achievements_created INTEGER DEFAULT 0,
  achievements_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_logs_user_id ON notion_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_logs_created_at ON notion_sync_logs(started_at DESC);
COMMENT ON TABLE notion_sync_logs IS 'Notion synchronization audit log';

-- ============================================
-- 13. anonymous_sessions (匿名会话)
-- ============================================
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id TEXT PRIMARY KEY,
  ip_hash TEXT,
  user_agent_hash TEXT,
  migrated_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_created_at ON anonymous_sessions(created_at DESC);
COMMENT ON TABLE anonymous_sessions IS 'Anonymous user sessions before signup';

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_work_experiences_updated_at
  BEFORE UPDATE ON work_experiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_prompt_configs_updated_at
  BEFORE UPDATE ON prompt_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_sync_logs ENABLE ROW LEVEL SECURITY;

-- profiles: users can only access their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- work_experiences: user_id match OR anonymous_id (handled in service layer)
CREATE POLICY "Users can CRUD own experiences"
  ON work_experiences FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- achievements: inherit from work_experiences (via experience_id)
CREATE POLICY "Users can CRUD own achievements"
  ON achievements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM work_experiences we
      WHERE we.id = achievements.experience_id
      AND (we.user_id = auth.uid() OR we.user_id IS NULL)
    )
  );

-- resume_versions
CREATE POLICY "Users can CRUD own resume versions"
  ON resume_versions FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- resume_uploads
CREATE POLICY "Users can view own uploads"
  ON resume_uploads FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT USING (auth.uid() = user_id);

-- notion_sync_logs
CREATE POLICY "Users can view own notion logs"
  ON notion_sync_logs FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Storage buckets
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('resumes', 'resumes', false, 10485760, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']),
  ('photos', 'photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Users can view own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- ============================================
-- rollback
-- ============================================
-- DROP TABLE IF EXISTS anonymous_sessions CASCADE;
-- DROP TABLE IF EXISTS notion_sync_logs CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS analytics_events CASCADE;
-- DROP TABLE IF EXISTS ai_call_logs CASCADE;
-- DROP TABLE IF EXISTS option_libraries CASCADE;
-- DROP TABLE IF EXISTS prompt_configs CASCADE;
-- DROP TABLE IF EXISTS paywall_settings CASCADE;
-- DROP TABLE IF EXISTS resume_uploads CASCADE;
-- DROP TABLE IF EXISTS resume_versions CASCADE;
-- DROP TABLE IF EXISTS achievements CASCADE;
-- DROP TABLE IF EXISTS work_experiences CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "vector";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
