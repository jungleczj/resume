-- Migration: 20260410000003_add_pii_gdpr_columns.sql
-- Description: Add pii_detected to resume_uploads (B3-5) and
--              deleted_at soft-delete to profiles (B3-4 GDPR)
-- Created: 2026-04-10

-- ── resume_uploads: PII detection flag ───────────────────────────────────────
ALTER TABLE resume_uploads
  ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN resume_uploads.pii_detected IS
  'True if detectPII() found phone/ID-card/address in the raw resume text. '
  'Used to show a one-time dismissible banner in the workspace.';

-- ── profiles: GDPR soft-delete ───────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deleted_at IS
  'Soft-delete timestamp. Null = active. '
  'A scheduled job hard-deletes all data 7 days after this is set (GDPR Article 17).';

-- Index so the nightly GDPR purge cron can quickly find candidates
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Prevent deleted users from logging in via RLS (Belt-and-suspenders —
-- the DELETE /api/user/account route also calls supabase.auth.signOut())
-- We rely on the application layer to check deleted_at before allowing access.
-- A DB-level trigger or policy can be added in Phase 2 if needed.

-- rollback:
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS pii_detected;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS idx_profiles_deleted_at;
