-- ============================================
-- Migration: 20260406000001_add_original_tenure.sql
-- Description: Add original_tenure field to preserve raw date format from resume
-- Created: 2026-04-06
-- ============================================

-- Add original_tenure column to preserve raw date format from resume
-- e.g., "Jun 2020 - Jan 2023" or "2020.06 - 2023.01"
ALTER TABLE work_experiences
ADD COLUMN IF NOT EXISTS original_tenure TEXT;

COMMENT ON COLUMN work_experiences.original_tenure IS 'Raw tenure string from original resume, e.g. Jun 2020 - Jan 2023';

-- Also add sort_order for consistent ordering
ALTER TABLE work_experiences
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add original_section to preserve raw resume structure order
ALTER TABLE work_experiences
ADD COLUMN IF NOT EXISTS original_section_order INTEGER DEFAULT 0;

COMMENT ON COLUMN work_experiences.sort_order IS 'User-defined or AI-determined sort order';

-- Add original_notion_text back to achievements if not exists
ALTER TABLE achievements
ADD COLUMN IF NOT EXISTS original_notion_text TEXT;

-- rollback
-- ALTER TABLE work_experiences DROP COLUMN IF EXISTS original_tenure;
-- ALTER TABLE work_experiences DROP COLUMN IF EXISTS sort_order;
-- ALTER TABLE work_experiences DROP COLUMN IF EXISTS original_section_order;
