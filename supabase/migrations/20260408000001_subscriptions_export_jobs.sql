-- ============================================
-- Migration: 20260408000001_subscriptions_export_jobs.sql
-- Description: Subscriptions table for recurring plans + export_jobs for async queue
-- Created: 2026-04-08
-- ============================================

-- ── Subscriptions table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  creem_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'grace')),
  current_period_end TIMESTAMPTZ NOT NULL,
  grace_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_anonymous_id ON subscriptions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creem_id ON subscriptions(creem_subscription_id);

COMMENT ON TABLE subscriptions IS 'Active recurring plan subscriptions';

-- ── Add export_format to payment_records (safe add) ─────────────────────────
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS export_format TEXT CHECK (export_format IN ('pdf', 'docx'));

-- Update plan_type constraint to also accept 'one_time'
ALTER TABLE payment_records DROP CONSTRAINT IF EXISTS payment_records_plan_type_check;
ALTER TABLE payment_records
  ADD CONSTRAINT payment_records_plan_type_check
    CHECK (plan_type IN ('one_time', 'per_export', 'monthly', 'yearly'));

-- ── export_jobs table (async export queue) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  payment_record_id UUID REFERENCES payment_records(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'docx')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  download_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_anonymous_id ON export_jobs(anonymous_id);

COMMENT ON TABLE export_jobs IS 'Async export job queue — max 2 concurrent';

-- rollback
-- DROP TABLE IF EXISTS export_jobs;
-- DROP TABLE IF EXISTS subscriptions;
-- ALTER TABLE payment_records DROP COLUMN IF EXISTS export_format;
