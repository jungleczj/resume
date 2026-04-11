-- Migration: 20260412000001_s02_market_confirm_analytics.sql
-- SERIAL_02: Dual-market strategy columns
-- 1. payment_market_confirmed flag on profiles
-- 2. analytics_events extended columns (geo_country, page_path, utm_*, market)
-- 3. admin_audit_log table for hot-reload operation log

-- ── 1. profiles: market confirmation flag ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_market_confirmed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.payment_market_confirmed IS
  'true once user has explicitly chosen cn_free or en_paid via the market modal';

-- ── 2. analytics_events: extended tracking columns ───────────────────────────
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS page_path    TEXT,
  ADD COLUMN IF NOT EXISTS referrer     TEXT,
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS market       TEXT,
  ADD COLUMN IF NOT EXISTS geo_country  TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_events_market
  ON analytics_events(market);

CREATE INDEX IF NOT EXISTS idx_analytics_events_geo
  ON analytics_events(geo_country);

COMMENT ON COLUMN analytics_events.geo_country IS
  'ISO country code from Vercel geo — analytics only, never used for payment decisions';

-- ── 3. admin_audit_log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action       TEXT NOT NULL,
  changed_by   TEXT NOT NULL,           -- 'admin' or sub-identifier
  ip_address   TEXT,
  resource     TEXT,
  before_value JSONB,
  after_value  JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
COMMENT ON TABLE admin_audit_log IS 'Audit log for admin hot-reload operations (paywall config, prompts, etc.)';

-- rollback
-- ALTER TABLE profiles DROP COLUMN IF EXISTS payment_market_confirmed;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS page_path;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS referrer;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS utm_source;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS utm_medium;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS utm_campaign;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS market;
-- ALTER TABLE analytics_events DROP COLUMN IF EXISTS geo_country;
-- DROP TABLE IF EXISTS admin_audit_log;
