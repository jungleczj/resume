-- ============================================================
-- Migration: 20260410000002_fix_all_missing_columns.sql
-- Purpose:   Ensure every column the parse/generate routes expect
--            actually exists in the DB.  Safe to run repeatedly —
--            every statement uses ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ── work_experiences ──────────────────────────────────────────────────────────

-- Date columns (some schema variants used start_year/end_year instead)
ALTER TABLE work_experiences
  ADD COLUMN IF NOT EXISTS start_date              DATE,
  ADD COLUMN IF NOT EXISTS end_date                DATE;

-- Tenure / sort (from 20260406000001)
ALTER TABLE work_experiences
  ADD COLUMN IF NOT EXISTS original_tenure         TEXT,
  ADD COLUMN IF NOT EXISTS original_section_order  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order              INTEGER DEFAULT 0;

-- Month-precision + enrichment (from 20260409000003)
ALTER TABLE work_experiences
  ADD COLUMN IF NOT EXISTS start_month             INTEGER,
  ADD COLUMN IF NOT EXISTS end_month               INTEGER,
  ADD COLUMN IF NOT EXISTS employment_type         TEXT DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS company_size            TEXT,
  ADD COLUMN IF NOT EXISTS company_type            TEXT,
  ADD COLUMN IF NOT EXISTS team_size               INTEGER,
  ADD COLUMN IF NOT EXISTS direct_reports          INTEGER,
  ADD COLUMN IF NOT EXISTS budget_managed          TEXT,
  ADD COLUMN IF NOT EXISTS reporting_to_title      TEXT;

-- ── achievements ──────────────────────────────────────────────────────────────

-- Sort order (present in 20260331000001 but not 20260330000002)
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS sort_order              INTEGER DEFAULT 0;

-- Project fields (from 20260407000003)
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS project_name            TEXT,
  ADD COLUMN IF NOT EXISTS project_member_role     TEXT;

-- Fortune 500 enrichment fields (from 20260409000004)
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS original_text           TEXT,
  ADD COLUMN IF NOT EXISTS impact_category         TEXT,
  ADD COLUMN IF NOT EXISTS is_featured             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS keywords                TEXT[];

-- ── resume_versions ───────────────────────────────────────────────────────────

-- Lang + auto-save flag (from 20260410000001)
ALTER TABLE resume_versions
  ADD COLUMN IF NOT EXISTS resume_lang             TEXT NOT NULL DEFAULT 'zh',
  ADD COLUMN IF NOT EXISTS is_auto_save            BOOLEAN NOT NULL DEFAULT true;

-- ── Ensure RLS policies exist for resume_versions ────────────────────────────
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versions_select_own"  ON resume_versions;
DROP POLICY IF EXISTS "versions_insert_own"  ON resume_versions;
DROP POLICY IF EXISTS "versions_delete_own"  ON resume_versions;

CREATE POLICY "versions_select_own" ON resume_versions
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR anonymous_id IS NOT NULL
  );

CREATE POLICY "versions_insert_own" ON resume_versions
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

CREATE POLICY "versions_delete_own" ON resume_versions
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR anonymous_id IS NOT NULL
  );

-- rollback:
-- ALTER TABLE work_experiences
--   DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS end_date,
--   DROP COLUMN IF EXISTS original_tenure, DROP COLUMN IF EXISTS original_section_order,
--   DROP COLUMN IF EXISTS start_month, DROP COLUMN IF EXISTS end_month,
--   DROP COLUMN IF EXISTS employment_type, DROP COLUMN IF EXISTS company_size,
--   DROP COLUMN IF EXISTS company_type, DROP COLUMN IF EXISTS team_size,
--   DROP COLUMN IF EXISTS direct_reports, DROP COLUMN IF EXISTS budget_managed,
--   DROP COLUMN IF EXISTS reporting_to_title;
-- ALTER TABLE achievements
--   DROP COLUMN IF EXISTS project_name, DROP COLUMN IF EXISTS project_member_role,
--   DROP COLUMN IF EXISTS original_text, DROP COLUMN IF EXISTS impact_category,
--   DROP COLUMN IF EXISTS is_featured, DROP COLUMN IF EXISTS keywords;
-- ALTER TABLE resume_versions
--   DROP COLUMN IF EXISTS resume_lang, DROP COLUMN IF EXISTS is_auto_save;
