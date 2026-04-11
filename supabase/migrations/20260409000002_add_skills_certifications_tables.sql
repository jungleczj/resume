-- Migration: 20260409000002_add_skills_certifications_tables.sql
-- Description: Create user_skills, certifications, spoken_languages, awards_honors tables
-- Created: 2026-04-09

-- ─── user_skills ──────────────────────────────────────────────────────────────
-- 独立技能表，替代 resume_uploads.parsed_data JSONB 中的 skills 数组
CREATE TABLE IF NOT EXISTS user_skills (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  skill_name          TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'programming_language',
                        'framework',
                        'tool',
                        'soft_skill',
                        'domain_knowledge',
                        'other'
                      )),
  proficiency_level   TEXT DEFAULT 'intermediate'
                      CHECK (proficiency_level IN (
                        'beginner',
                        'intermediate',
                        'advanced',
                        'expert'
                      )),
  years_of_experience NUMERIC(4,1),   -- 使用年限，e.g. 3.5
  is_featured         BOOLEAN DEFAULT false,  -- 重点技能，显示在简历技能区首位
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT user_skills_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id      ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_anonymous_id ON user_skills(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_category     ON user_skills(category);

-- ─── certifications ───────────────────────────────────────────────────────────
-- 证书资质表（IT/金融/咨询/医疗岗位刚需）
CREATE TABLE IF NOT EXISTS certifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  name                TEXT NOT NULL,    -- e.g. "PMP"、"CFA Level III"、"AWS Solutions Architect"
  issuing_org         TEXT,             -- 颁发机构，e.g. "PMI"、"CFA Institute"、"Amazon Web Services"
  issue_year          INTEGER,
  issue_month         INTEGER CHECK (issue_month BETWEEN 1 AND 12),
  expiry_year         INTEGER,
  expiry_month        INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
  is_current          BOOLEAN DEFAULT true,   -- false = 已过期
  credential_id       TEXT,             -- 证书编号/License Number
  verification_url    TEXT,             -- 在线核验链接
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT certifications_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_certifications_user_id      ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_anonymous_id ON certifications(anonymous_id);

-- ─── spoken_languages ─────────────────────────────────────────────────────────
-- 口语语言表（区别于编程语言技能，跨国公司刚需）
-- 使用 LinkedIn 标准的五级能力模型
CREATE TABLE IF NOT EXISTS spoken_languages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  language_name       TEXT NOT NULL,    -- e.g. "English"、"普通话"、"日本語"、"Français"
  proficiency         TEXT NOT NULL DEFAULT 'professional_working'
                      CHECK (proficiency IN (
                        'elementary',           -- 初级 / Elementary
                        'limited_working',      -- 有限工作 / Limited Working
                        'professional_working', -- 专业工作 / Professional Working
                        'full_professional',    -- 完全专业 / Full Professional
                        'native_bilingual'      -- 母语或双母语 / Native or Bilingual
                      )),
  is_native           BOOLEAN DEFAULT false,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT spoken_languages_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_spoken_languages_user_id      ON spoken_languages(user_id);
CREATE INDEX IF NOT EXISTS idx_spoken_languages_anonymous_id ON spoken_languages(anonymous_id);

-- ─── awards_honors ────────────────────────────────────────────────────────────
-- 奖项荣誉表（500强招聘官非常关注的区分因素）
CREATE TABLE IF NOT EXISTS awards_honors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  title               TEXT NOT NULL,    -- e.g. "年度最佳员工"、"Forbes 30 Under 30"
  issuing_org         TEXT,             -- 颁奖机构/公司，e.g. "McKinsey & Company"
  award_year          INTEGER,
  award_month         INTEGER CHECK (award_month BETWEEN 1 AND 12),
  description         TEXT,             -- 奖项简介，一到两句话
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT awards_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_awards_user_id      ON awards_honors(user_id);
CREATE INDEX IF NOT EXISTS idx_awards_anonymous_id ON awards_honors(anonymous_id);

-- rollback:
-- DROP TABLE IF EXISTS user_skills, certifications, spoken_languages, awards_honors;
