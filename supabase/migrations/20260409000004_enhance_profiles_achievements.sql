-- Migration: 20260409000004_enhance_profiles_achievements.sql
-- Description: Add Fortune 500 resume fields to profiles and achievements tables
-- Created: 2026-04-09

-- ─── profiles 补全 ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name             TEXT,
  -- 专业定位一句话（显示在简历名字下方，替代纯职位名）
  ADD COLUMN IF NOT EXISTS professional_headline TEXT,
  -- 工作签证状态（仅 EN 市场使用，CN 市场留 null）
  ADD COLUMN IF NOT EXISTS work_authorization    TEXT
                                                 CHECK (work_authorization IN (
                                                   'citizen',
                                                   'permanent_resident',
                                                   'visa_h1b',
                                                   'visa_other',
                                                   'not_required'   -- 本国公民，非美国申请
                                                 )),
  -- 社交/作品链接（与简历解析出的链接分开存储，作为用户档案基准值）
  ADD COLUMN IF NOT EXISTS linkedin_url          TEXT,
  ADD COLUMN IF NOT EXISTS github_url            TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url         TEXT;

COMMENT ON COLUMN profiles.full_name             IS '用户全名，可与 auth.users.user_metadata.full_name 同步';
COMMENT ON COLUMN profiles.professional_headline IS '专业定位，e.g. "Senior PM | AI/ML | 10+ yrs Fortune 500"';
COMMENT ON COLUMN profiles.work_authorization    IS '工作签证状态，仅 EN 市场填写';
COMMENT ON COLUMN profiles.linkedin_url          IS 'LinkedIn 主页 URL';
COMMENT ON COLUMN profiles.github_url            IS 'GitHub 主页 URL';
COMMENT ON COLUMN profiles.portfolio_url         IS '作品集/个人网站 URL';

-- ─── achievements 补全 ───────────────────────────────────────────────────────
ALTER TABLE achievements
  -- F1路径的原始 bullet 文本（AI美化前）
  -- F2路径已有 original_notion_text，此列统一处理 F1
  ADD COLUMN IF NOT EXISTS original_text     TEXT,

  -- 成就影响类别（用于简历诊断报告 / 筛选 / 可视化）
  ADD COLUMN IF NOT EXISTS impact_category   TEXT
                                             CHECK (impact_category IN (
                                               'revenue',     -- 收入增长
                                               'cost',        -- 成本降低
                                               'efficiency',  -- 效率提升
                                               'scale',       -- 规模扩张
                                               'quality',     -- 质量改善
                                               'team',        -- 团队建设/人才发展
                                               'product',     -- 产品创新
                                               'process',     -- 流程优化
                                               'other'
                                             )),

  -- 用户标记的精选成就（简历生成时优先选入，成就库首屏展示）
  ADD COLUMN IF NOT EXISTS is_featured       BOOLEAN DEFAULT false,

  -- ATS 关键词数组（AI 从成就文本中提取，用于 JD 匹配得分）
  ADD COLUMN IF NOT EXISTS keywords          TEXT[];

COMMENT ON COLUMN achievements.original_text   IS 'AI美化前的原始bullet文本，F1路径保存原文供对照';
COMMENT ON COLUMN achievements.impact_category IS '成就影响类别，用于诊断报告和筛选';
COMMENT ON COLUMN achievements.is_featured     IS '精选标记：简历生成时优先入选，成就库置顶';
COMMENT ON COLUMN achievements.keywords        IS 'ATS关键词数组，AI提取，供JD相似度匹配使用';

-- 精选成就快速查询索引
CREATE INDEX IF NOT EXISTS idx_achievements_featured
  ON achievements(user_id, is_featured)
  WHERE is_featured = true;

-- 影响类别聚合索引（诊断报告用）
CREATE INDEX IF NOT EXISTS idx_achievements_impact_category
  ON achievements(impact_category)
  WHERE impact_category IS NOT NULL;

-- rollback:
-- ALTER TABLE profiles
--   DROP COLUMN IF EXISTS full_name,
--   DROP COLUMN IF EXISTS professional_headline,
--   DROP COLUMN IF EXISTS work_authorization,
--   DROP COLUMN IF EXISTS linkedin_url,
--   DROP COLUMN IF EXISTS github_url,
--   DROP COLUMN IF EXISTS portfolio_url;
-- ALTER TABLE achievements
--   DROP COLUMN IF EXISTS original_text,
--   DROP COLUMN IF EXISTS impact_category,
--   DROP COLUMN IF EXISTS is_featured,
--   DROP COLUMN IF EXISTS keywords;
-- DROP INDEX IF EXISTS idx_achievements_featured;
-- DROP INDEX IF EXISTS idx_achievements_impact_category;
