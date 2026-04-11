-- Migration: 20260410000001_resume_versions_add_lang_autosave.sql
-- Description: Add resume_lang and is_auto_save columns to resume_versions;
--              add RLS policies to allow anonymous inserts/reads.
-- Created: 2026-04-10

-- ── Add missing columns ────────────────────────────────────────────────────────
ALTER TABLE resume_versions
  ADD COLUMN IF NOT EXISTS resume_lang  TEXT    NOT NULL DEFAULT 'zh'
                                                CHECK (resume_lang IN ('zh', 'en', 'bilingual')),
  ADD COLUMN IF NOT EXISTS is_auto_save BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN resume_versions.resume_lang  IS '简历语言：zh | en | bilingual';
COMMENT ON COLUMN resume_versions.is_auto_save IS 'true = 自动保存快照；false = 用户手动保存（有 snapshot_label）';

-- ── Enable RLS if not already enabled ─────────────────────────────────────────
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

-- ── RLS: authenticated users own their rows ───────────────────────────────────
DROP POLICY IF EXISTS "versions_select_own" ON resume_versions;
DROP POLICY IF EXISTS "versions_insert_own" ON resume_versions;
DROP POLICY IF EXISTS "versions_delete_own" ON resume_versions;

CREATE POLICY "versions_select_own"
  ON resume_versions FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR anonymous_id IS NOT NULL
  );

CREATE POLICY "versions_insert_own"
  ON resume_versions FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

CREATE POLICY "versions_delete_own"
  ON resume_versions FOR DELETE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- rollback:
-- ALTER TABLE resume_versions
--   DROP COLUMN IF EXISTS resume_lang,
--   DROP COLUMN IF EXISTS is_auto_save;
-- DROP POLICY IF EXISTS "versions_select_own" ON resume_versions;
-- DROP POLICY IF EXISTS "versions_insert_own" ON resume_versions;
-- DROP POLICY IF EXISTS "versions_delete_own" ON resume_versions;
