-- ============================================================
-- Migration: 20260410130000_add_pii_detected_column.sql
-- Description: Add pii_detected boolean to resume_uploads.
--              Per PARALLEL_B3 §9.2: after parsing, regex-detect
--              phone / ID / address PII and set this flag.
--              The workspace shows a dismissible banner when true.
-- Created: 2026-04-10
-- ============================================================

ALTER TABLE resume_uploads
  ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN resume_uploads.pii_detected IS
  'Set to true when the parser regex-detects PII (phone/ID/address) '
  'in the raw resume text. Triggers a one-time dismissible warning '
  'banner in the workspace (B3 §9.2). Does NOT cause automatic redaction.';

-- Optional index: workspace query filters on pii_detected=true for banner
CREATE INDEX IF NOT EXISTS idx_resume_uploads_pii_detected
  ON resume_uploads(pii_detected)
  WHERE pii_detected = true;

-- rollback:
-- DROP INDEX IF EXISTS idx_resume_uploads_pii_detected;
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS pii_detected;
