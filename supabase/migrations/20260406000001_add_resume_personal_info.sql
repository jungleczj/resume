-- Migration: 20260406000001_add_resume_personal_info.sql
-- Description: Add parsed_info and raw_text fields to resume_uploads for storing extracted resume data
-- Created: 2026-04-06

-- Add JSONB column to store parsed personal information (name, email, phone, location, linkedin, website)
ALTER TABLE resume_uploads
ADD COLUMN IF NOT EXISTS parsed_info JSONB DEFAULT NULL;

-- Add TEXT column to store raw text from resume
ALTER TABLE resume_uploads
ADD COLUMN IF NOT EXISTS raw_text TEXT DEFAULT NULL;

-- Add parse_status column if not exists (may already exist from previous migrations)
ALTER TABLE resume_uploads
ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT 'pending' 
CHECK (parse_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add parse_error column for error messages
ALTER TABLE resume_uploads
ADD COLUMN IF NOT EXISTS parse_error TEXT DEFAULT NULL;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_resume_uploads_parsed_info 
ON resume_uploads USING GIN (parsed_info);

CREATE INDEX IF NOT EXISTS idx_resume_uploads_parse_status 
ON resume_uploads(parse_status);

CREATE INDEX IF NOT EXISTS idx_resume_uploads_raw_text_search 
ON resume_uploads USING GIN (to_tsvector('simple', COALESCE(raw_text, '')));

COMMENT ON COLUMN resume_uploads.parsed_info IS 'Extracted personal info: name, email, phone, location, linkedin, website';
COMMENT ON COLUMN resume_uploads.raw_text IS 'Raw text extracted from resume file';
COMMENT ON COLUMN resume_uploads.parse_status IS 'Parse status: pending, processing, completed, failed';
COMMENT ON COLUMN resume_uploads.parse_error IS 'Error message if parse failed';

-- rollback
-- DROP INDEX IF EXISTS idx_resume_uploads_parsed_info;
-- DROP INDEX IF EXISTS idx_resume_uploads_parse_status;
-- DROP INDEX IF EXISTS idx_resume_uploads_raw_text_search;
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS parsed_info;
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS raw_text;
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS parse_status;
-- ALTER TABLE resume_uploads DROP COLUMN IF EXISTS parse_error;
