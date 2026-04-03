-- ============================================
-- Migration: 20260330000006_config_tables.sql
-- Description: Configuration tables for prompts, paywall, and options
-- Created: 2026-03-30
-- ============================================

CREATE TABLE IF NOT EXISTS prompt_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_key TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('cn', 'en')),
  prompt_text TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_key, market, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_configs_task_market ON prompt_configs(task_key, market, is_active);
COMMENT ON TABLE prompt_configs IS 'AI prompt configurations with hot reload';

CREATE TABLE IF NOT EXISTS paywall_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market TEXT NOT NULL CHECK (market IN ('cn_free', 'en_paid')),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('per_export', 'monthly', 'yearly')),
  price_usd DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paywall_settings_market ON paywall_settings(market, is_active);
COMMENT ON TABLE paywall_settings IS 'Paywall pricing configuration';

CREATE TABLE IF NOT EXISTS option_libraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  option_key TEXT NOT NULL,
  display_text_zh TEXT,
  display_text_en TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_option_libraries_category ON option_libraries(category, is_active);
COMMENT ON TABLE option_libraries IS 'Dropdown options library';

-- rollback
-- DROP TABLE IF EXISTS option_libraries;
-- DROP TABLE IF EXISTS paywall_settings;
-- DROP TABLE IF EXISTS prompt_configs;
