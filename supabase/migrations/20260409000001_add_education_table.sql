-- Migration: 20260409000001_add_education_table.sql
-- Description: Create standalone education table (replaces JSONB-only storage in resume_uploads.parsed_data)
-- Created: 2026-04-09

CREATE TABLE IF NOT EXISTS education (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  institution_name    TEXT NOT NULL,
  degree_type         TEXT CHECK (degree_type IN (
                        'high_school','associate','bachelor','master',
                        'mba','phd','jd','md','certificate','other'
                      )),
  field_of_study      TEXT,           -- 主修专业
  minor_field         TEXT,           -- 辅修专业
  start_year          INTEGER,
  end_year            INTEGER,
  is_current          BOOLEAN DEFAULT false,

  -- 学术表现
  gpa_score           NUMERIC(4,2),
  gpa_scale           NUMERIC(4,2),   -- 满分基准，通常 4.0 或 5.0
  class_rank_text     TEXT,           -- e.g. "Top 5%"、"1/200"、"前10%"
  academic_honors     TEXT,           -- e.g. "Dean's List"、"优秀毕业生"、"Summa Cum Laude"

  -- 附加信息（500强简历常见）
  thesis_title        TEXT,           -- 学位论文题目
  activities          TEXT,           -- 学生会/社团/课外活动
  study_abroad        TEXT,           -- 交换项目，e.g. "UC Berkeley Exchange 2021"

  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT education_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_education_user_id      ON education(user_id);
CREATE INDEX IF NOT EXISTS idx_education_anonymous_id ON education(anonymous_id);

COMMENT ON TABLE  education                    IS '独立教育经历表，支持完整学术信息存储';
COMMENT ON COLUMN education.gpa_scale          IS '满分基准，通常4.0或5.0';
COMMENT ON COLUMN education.class_rank_text    IS '班级排名文字描述，保留原始表述';
COMMENT ON COLUMN education.academic_honors    IS '学术荣誉，如Dean''s List、优秀毕业生';
COMMENT ON COLUMN education.study_abroad       IS '交换/访学信息';

-- rollback: DROP TABLE IF EXISTS education;
