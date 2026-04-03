-- ============================================
-- Migration: 20260330000004_payment_tables.sql
-- Description: Payment and subscription tables
-- Created: 2026-03-30
-- ============================================

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  market TEXT NOT NULL,
  provider TEXT DEFAULT 'creem',
  currency TEXT DEFAULT 'USD',
  amount DECIMAL(10,2) NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('per_export', 'monthly', 'yearly')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  creem_session_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_anonymous_id ON payment_records(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
COMMENT ON TABLE payment_records IS 'Payment transaction records';

CREATE TABLE IF NOT EXISTS anonymous_payment_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_id TEXT NOT NULL,
  payment_record_id UUID REFERENCES payment_records(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending_migration' CHECK (status IN ('pending_migration', 'migrated')),
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_payment_map_anonymous_id ON anonymous_payment_map(anonymous_id);
COMMENT ON TABLE anonymous_payment_map IS 'Maps anonymous payments to user accounts';

-- rollback
-- DROP TABLE IF EXISTS anonymous_payment_map;
-- DROP TABLE IF EXISTS payment_records;
