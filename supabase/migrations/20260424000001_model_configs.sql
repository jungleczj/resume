-- Migration: 20260424000001_model_configs.sql
-- Description: AI model registry + per-task model chain config (DB-driven hot update)
-- Created: 2026-04-24

-- ── 模型注册表（很少变动，只需维护一次）────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_models (
  id         SMALLINT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,    -- 实际传给 API 的模型名
  provider   TEXT NOT NULL            -- qianwen | deepseek | openai | claude
    CHECK (provider IN ('qianwen', 'deepseek', 'openai', 'claude')),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ai_models (id, name, provider) VALUES
  (1, 'qwen-long',                  'qianwen'),
  (2, 'qwen-turbo',                 'qianwen'),
  (3, 'deepseek-chat',              'deepseek'),
  (4, 'gpt-4o-mini',                'openai'),
  (5, 'gpt-4o',                     'openai'),
  (6, 'claude-sonnet-4-20250514',   'claude'),
  (7, 'claude-haiku-4-5-20251001',  'claude')
ON CONFLICT (id) DO NOTHING;

-- ── 任务→模型链配置（日常只改这张表）────────────────────────────────────────────
-- model_chain: 整数 ID 有序数组，如 [1,3,4,6]
--   含义：先试 id=1 的模型，失败后试 id=3，以此类推
--   改顺序只需一条 SQL，60 秒内生效，无需重新部署
CREATE TABLE IF NOT EXISTS model_configs (
  task_key    TEXT PRIMARY KEY,        -- 对应 AITask 枚举值
  model_chain JSONB NOT NULL,          -- 整数 ID 有序数组
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 初始值与代码中 MODEL_CHAINS 硬编码完全一致
INSERT INTO model_configs (task_key, model_chain) VALUES
  ('resume_beautify',             '[1,3,4,6]'),
  ('resume_structure_extract',    '[1,3,4,6]'),
  ('resume_achievement_beautify', '[2,3,4,7]'),
  ('jd_parse',                    '[2,3,4,7]'),
  ('achievement_extract',         '[1,3,4,6]'),
  ('achievement_match',           '[2,3,4,7]'),
  ('resume_translate',            '[2,3,7]'),
  ('resume_profile_translate',    '[2,3,7]'),
  ('resume_summary_generate',     '[1,3,4,6]')
ON CONFLICT (task_key) DO NOTHING;

-- ── RLS：服务端可读，anon 只读 ────────────────────────────────────────────────
ALTER TABLE ai_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read ai_models"     ON ai_models     FOR SELECT USING (true);
CREATE POLICY "anon read model_configs" ON model_configs FOR SELECT USING (true);

-- rollback
-- DROP POLICY IF EXISTS "anon read model_configs" ON model_configs;
-- DROP POLICY IF EXISTS "anon read ai_models"     ON ai_models;
-- DROP TABLE IF EXISTS model_configs;
-- DROP TABLE IF EXISTS ai_models;
