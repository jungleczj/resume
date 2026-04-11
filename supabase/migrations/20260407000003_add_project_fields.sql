-- ============================================================
-- Migration: 20260407000003_add_project_fields.sql
-- Description: Add project-level fields to achievements table
--   project_name       — 所属子项目名称（null = 直接挂在工作经历下）
--   project_member_role — 候选人在该项目中的具体角色（区别于公司职位）
-- Created: 2026-04-07
-- ============================================================

ALTER TABLE achievements
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS project_member_role TEXT;

COMMENT ON COLUMN achievements.project_name IS '子项目名称；null 表示该成就直接属于工作经历，无具体子项目';
COMMENT ON COLUMN achievements.project_member_role IS '候选人在该子项目中的角色（如技术负责人、后端开发），区别于公司层面的 job_title';

-- rollback
-- ALTER TABLE achievements DROP COLUMN IF EXISTS project_name;
-- ALTER TABLE achievements DROP COLUMN IF EXISTS project_member_role;
