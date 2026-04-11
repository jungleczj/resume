-- Migration: 20260409000005_add_publications_table.sql
-- Description: Create publications table for papers, patents, books, whitepapers
-- Applicable to: senior/research/tech/consulting/academic roles in Fortune 500
-- Created: 2026-04-09

CREATE TABLE IF NOT EXISTS publications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id        TEXT,

  -- ── 基础分类 ─────────────────────────────────────────────────────────────
  title               TEXT NOT NULL,
  pub_type            TEXT NOT NULL DEFAULT 'journal'
                      CHECK (pub_type IN (
                        'journal',        -- 期刊论文（SCI/EI/SSCI/CSSCI）
                        'conference',     -- 会议论文（ACM/IEEE/NeurIPS/CVPR等）
                        'book',           -- 专著/教材
                        'book_chapter',   -- 书籍章节
                        'patent',         -- 发明/实用新型/外观设计专利
                        'white_paper',    -- 行业白皮书/技术报告
                        'report',         -- 研究报告/咨询报告
                        'blog',           -- 技术博客/专栏（InfoQ/Medium/知乎专栏）
                        'other'
                      )),

  -- ── 作者信息 ─────────────────────────────────────────────────────────────
  authors             TEXT[],             -- 全体作者列表，按署名顺序
  author_position     INTEGER,            -- 本人排名（1=第一作者，null=不详）

  -- ── 发表载体 ─────────────────────────────────────────────────────────────
  publication_venue   TEXT,               -- 期刊名 / 会议名 / 专利局 / 出版社
  publisher           TEXT,               -- 出版商（书籍场景），e.g. "Springer", "机械工业出版社"
  pub_year            INTEGER,
  pub_month           INTEGER CHECK (pub_month BETWEEN 1 AND 12),
  volume              TEXT,               -- 卷号，e.g. "42"
  issue               TEXT,               -- 期号，e.g. "3"
  pages               TEXT,               -- 页码，e.g. "123-145" 或 "e12345"

  -- ── 唯一标识符 ────────────────────────────────────────────────────────────
  doi                 TEXT,               -- DOI，e.g. "10.1145/1234567.1234568"
  patent_number       TEXT,               -- 专利号，e.g. "CN202310123456.7"
  arxiv_id            TEXT,               -- arXiv ID，e.g. "2301.00001"
  isbn                TEXT,               -- 书号（书籍场景）
  url                 TEXT,               -- 可公开访问的链接

  -- ── 影响力指标（高级岗位候选人常标注）────────────────────────────────
  citation_count      INTEGER,            -- 引用次数（Google Scholar / Web of Science）
  impact_factor       NUMERIC(6,3),       -- 期刊影响因子（最新年份）

  -- ── 发表状态 ─────────────────────────────────────────────────────────────
  status              TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN (
                        'published',       -- 已正式发表
                        'accepted',        -- 已录用，待出版
                        'under_review',    -- 审稿中（投稿后）
                        'preprint',        -- 预印本（已公开但未同行评审）
                        'in_preparation'   -- 撰写/准备中
                      )),

  -- ── 简历展示摘要 ─────────────────────────────────────────────────────────
  description         TEXT,               -- 一到两句话说明研究内容/贡献/意义

  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT publications_owner_check CHECK (
    (user_id IS NOT NULL) OR (anonymous_id IS NOT NULL)
  )
);

-- 基础查询索引
CREATE INDEX IF NOT EXISTS idx_publications_user_id      ON publications(user_id);
CREATE INDEX IF NOT EXISTS idx_publications_anonymous_id ON publications(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_publications_type         ON publications(pub_type);
CREATE INDEX IF NOT EXISTS idx_publications_year         ON publications(pub_year DESC NULLS LAST);

-- 已发表成果快速筛选
CREATE INDEX IF NOT EXISTS idx_publications_published
  ON publications(user_id, pub_year DESC)
  WHERE status = 'published';

COMMENT ON TABLE  publications                IS '学术/专利/出版成果表，适用于研究/技术/咨询/高管简历';
COMMENT ON COLUMN publications.pub_type       IS '成果类型：期刊/会议/书籍/专利/白皮书等';
COMMENT ON COLUMN publications.authors        IS '作者列表数组，按署名顺序排列';
COMMENT ON COLUMN publications.author_position IS '本人在作者列表中的排名，1=第一作者';
COMMENT ON COLUMN publications.publication_venue IS '期刊名、会议名或出版机构';
COMMENT ON COLUMN publications.citation_count IS '被引用次数，来源Google Scholar或Web of Science';
COMMENT ON COLUMN publications.impact_factor  IS '期刊影响因子（最新年份JCR数据）';
COMMENT ON COLUMN publications.status         IS '发表状态：已发表/已录用/审稿中/预印本/准备中';
COMMENT ON COLUMN publications.description    IS '一两句话说明研究意义，用于简历展示';

-- rollback: DROP TABLE IF EXISTS publications;
