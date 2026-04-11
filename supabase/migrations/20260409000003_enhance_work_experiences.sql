-- Migration: 20260409000003_enhance_work_experiences.sql
-- Description: Add Fortune 500 resume fields to work_experiences table
-- Created: 2026-04-09
--
-- Key fix: start_month / end_month were extracted by the AI parser but were
-- discarded (stored only as YYYY-01-01 in start_date/end_date), losing month
-- precision. These columns restore that precision.

ALTER TABLE work_experiences
  -- ── 月份精度（解析器已提取但 DB 未存储）────────────────────────────────
  ADD COLUMN IF NOT EXISTS start_month         INTEGER CHECK (start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS end_month           INTEGER CHECK (end_month BETWEEN 1 AND 12),

  -- ── 雇佣类型 ─────────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS employment_type     TEXT DEFAULT 'full_time'
                                               CHECK (employment_type IN (
                                                 'full_time',
                                                 'part_time',
                                                 'contract',
                                                 'internship',
                                                 'freelance',
                                                 'volunteer'
                                               )),

  -- ── 公司规模与类型（体现候选人所在平台量级）──────────────────────────
  ADD COLUMN IF NOT EXISTS company_size        TEXT
                                               CHECK (company_size IN (
                                                 '<50',
                                                 '50-200',
                                                 '200-1000',
                                                 '1000-5000',
                                                 '>5000'
                                               )),
  ADD COLUMN IF NOT EXISTS company_type        TEXT
                                               CHECK (company_type IN (
                                                 'public',       -- 上市公司
                                                 'private',      -- 私营企业
                                                 'startup',      -- 初创公司
                                                 'soe',          -- 国有企业
                                                 'ngo',          -- 非盈利/NGO
                                                 'government',   -- 政府机构
                                                 'fortune500',   -- 世界500强
                                                 'other'
                                               )),

  -- ── 管理规模（核心竞争力指标）────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS team_size           INTEGER,  -- 所在/管理团队总人数
  ADD COLUMN IF NOT EXISTS direct_reports      INTEGER,  -- 直接下属人数

  -- ── 预算与汇报线（体现职级和影响力）──────────────────────────────────
  ADD COLUMN IF NOT EXISTS budget_managed      TEXT,     -- e.g. "$2M annual operating budget"
  ADD COLUMN IF NOT EXISTS reporting_to_title  TEXT;     -- 上级职位，e.g. "VP of Engineering"

COMMENT ON COLUMN work_experiences.start_month        IS '入职月份(1-12)，配合 start_date 提供月级精度';
COMMENT ON COLUMN work_experiences.end_month          IS '离职月份(1-12)，配合 end_date 提供月级精度';
COMMENT ON COLUMN work_experiences.employment_type    IS '雇佣类型：全职/兼职/合同/实习/自由职业/志愿者';
COMMENT ON COLUMN work_experiences.company_size       IS '公司规模区间，体现候选人平台量级';
COMMENT ON COLUMN work_experiences.company_type       IS '公司性质：上市/私营/初创/国企/500强等';
COMMENT ON COLUMN work_experiences.team_size          IS '管理或所在团队总人数';
COMMENT ON COLUMN work_experiences.direct_reports     IS '直接下属人数，体现管理宽度';
COMMENT ON COLUMN work_experiences.budget_managed     IS '掌管预算规模文字描述，保留量级表述';
COMMENT ON COLUMN work_experiences.reporting_to_title IS '直接上级职位名称，体现组织层级';

-- rollback:
-- ALTER TABLE work_experiences
--   DROP COLUMN IF EXISTS start_month,
--   DROP COLUMN IF EXISTS end_month,
--   DROP COLUMN IF EXISTS employment_type,
--   DROP COLUMN IF EXISTS company_size,
--   DROP COLUMN IF EXISTS company_type,
--   DROP COLUMN IF EXISTS team_size,
--   DROP COLUMN IF EXISTS direct_reports,
--   DROP COLUMN IF EXISTS budget_managed,
--   DROP COLUMN IF EXISTS reporting_to_title;
