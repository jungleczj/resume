-- ============================================
-- Seed: 001_paywall_settings.sql
-- Description: Paywall configuration for en_paid market
-- Note: paywall_settings table is created in migration 20260331000001_initial_schema.sql
-- ============================================

INSERT INTO paywall_settings (market, is_enabled, trigger_event, price_usd, payment_provider, plan_type, config)
VALUES
  ('en_paid', true, 'export_clicked', 9.90, 'creem', 'one_time',
   '{"trial_days": 7, "export_limit_free": 0, "currency": "USD"}'::jsonb),
  ('en_paid', true, 'achievement_limit_reached', 9.90, 'creem', 'one_time',
   '{"free_achievement_limit": 20}'::jsonb)
ON CONFLICT (market, trigger_event) DO UPDATE
  SET price_usd = EXCLUDED.price_usd,
      config = EXCLUDED.config,
      updated_at = now();
