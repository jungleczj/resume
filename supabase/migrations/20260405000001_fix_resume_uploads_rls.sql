-- Migration: 20260405000001_fix_resume_uploads_rls.sql
-- Description: Add INSERT and UPDATE RLS policies for resume_uploads table
-- F1 flow allows anonymous (no-login) uploads; the table needs INSERT policy
-- Parse route updates parse_status; needs UPDATE policy
-- Created: 2026-04-05

-- INSERT: allow authenticated users (own row) and anonymous users (user_id IS NULL)
CREATE POLICY "Allow insert resume uploads"
  ON resume_uploads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
  );

-- UPDATE: parse route (called server-side with internal secret) updates parse_status.
-- Allow: authenticated owner OR anonymous row (user_id IS NULL)
CREATE POLICY "Allow update own resume uploads"
  ON resume_uploads FOR UPDATE
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
  );

-- rollback
-- DROP POLICY IF EXISTS "Allow insert resume uploads" ON resume_uploads;
-- DROP POLICY IF EXISTS "Allow update own resume uploads" ON resume_uploads;
