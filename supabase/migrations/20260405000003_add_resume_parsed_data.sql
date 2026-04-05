-- Migration: 20260405000003_add_resume_parsed_data.sql
-- Description: Add parsed_data JSONB to resume_uploads for storing personal_info, education, skills
-- Created: 2026-04-05

ALTER TABLE resume_uploads
  ADD COLUMN IF NOT EXISTS parsed_data JSONB;

-- rollback
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS parsed_data;
