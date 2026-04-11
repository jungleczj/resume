-- ============================================================
-- Migration: 20260410140000_add_profiles_deleted_at.sql
-- Description: Add deleted_at (soft-delete) and gdpr_export_requested_at
--              columns to profiles table for GDPR compliance.
--
--              Per PARALLEL_B3 §9.3 (T-B3-4):
--              • Soft-delete: profiles.deleted_at = now() → blocks login
--              • Hard-delete Cron: runs nightly, cascades after 7 days
--              • gdpr_export_requested_at: tracks last Article-20 export
--                request so the API can rate-limit re-requests.
-- Created: 2026-04-10
-- ============================================================

-- Soft-delete timestamp — null means account is active
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.deleted_at IS
  'GDPR soft-delete: set to now() when user requests account deletion. '
  'Auth login is disabled immediately. A nightly Cron hard-deletes '
  'all cascade data 7 days after this timestamp (B3 §9.3 T-B3-4).';

-- Tracks last GDPR Article-20 data-export request (rate-limiting re-requests)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gdpr_export_requested_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.gdpr_export_requested_at IS
  'Timestamp of the last GDPR Article-20 data export request. '
  'API uses this to rate-limit re-requests (max 1 per 24h per user).';

-- Partial index: the nightly Cron queries only soft-deleted rows
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Guard: update existing RLS to exclude soft-deleted profiles from SELECT
-- (users who have deleted_at set should not be able to log back in and read data)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);

-- rollback:
-- DROP INDEX  IF EXISTS idx_profiles_deleted_at;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS gdpr_export_requested_at;
-- (Recreate original RLS policies without deleted_at guard if rolling back)
