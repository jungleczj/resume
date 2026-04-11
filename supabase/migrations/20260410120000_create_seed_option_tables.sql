-- ============================================================
-- Migration: 20260410120000_create_seed_option_tables.sql
-- Description: Create four dedicated seed/option lookup tables
--              per PARALLEL_C2 spec (positions, skills, companies, schools)
-- Created: 2026-04-10
-- ============================================================

-- ── seed_positions ────────────────────────────────────────────────────────────
-- Preloaded job title library: ≥100 common positions grouped by industry.
-- Supports zh/en bilingual display and free-text custom input from the UI.
CREATE TABLE IF NOT EXISTS seed_positions (
  id          SERIAL       PRIMARY KEY,
  name_zh     TEXT         NOT NULL UNIQUE,
  name_en     TEXT         NOT NULL,
  industry    TEXT         NOT NULL, -- e.g. 'tech', 'finance', 'education'
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seed_positions_industry  ON seed_positions(industry)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seed_positions_name_zh   ON seed_positions(name_zh)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seed_positions_name_en   ON seed_positions USING gin(to_tsvector('english', name_en));

COMMENT ON TABLE  seed_positions           IS 'Pre-loaded job title / position lookup library (C2 spec, ≥100 rows)';
COMMENT ON COLUMN seed_positions.industry  IS 'Industry group key matching option_libraries industry values';

-- ── seed_skills ───────────────────────────────────────────────────────────────
-- Preloaded skill tag library: ≥300 skills across 5 categories.
-- UI enforces max 20 selected skills per resume.
CREATE TABLE IF NOT EXISTS seed_skills (
  id          SERIAL       PRIMARY KEY,
  name_zh     TEXT         NOT NULL UNIQUE,
  name_en     TEXT         NOT NULL,
  category    TEXT         NOT NULL, -- 'programming'|'framework'|'tool'|'soft_skill'|'language'
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seed_skills_category  ON seed_skills(category)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seed_skills_name_zh   ON seed_skills(name_zh)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seed_skills_name_en   ON seed_skills USING gin(to_tsvector('english', name_en));

COMMENT ON TABLE  seed_skills          IS 'Pre-loaded skill tag library (C2 spec, ≥300 rows, max 20 selectable per resume)';
COMMENT ON COLUMN seed_skills.category IS 'Skill category: programming | framework | tool | soft_skill | language';

-- ── seed_companies ────────────────────────────────────────────────────────────
-- Company search index: Chinese TOP500 + Fortune 500.
-- UI uses server-side ilike search with 300ms debounce.
CREATE TABLE IF NOT EXISTS seed_companies (
  id          SERIAL       PRIMARY KEY,
  name_zh     TEXT         NOT NULL UNIQUE,
  name_en     TEXT         NOT NULL,
  category    TEXT         NOT NULL, -- 'cn_top500' | 'fortune500' | 'tech' | 'startup'
  industry    TEXT,                  -- optional detailed industry tag
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- GIN trigram index enables fast ilike '%keyword%' search (requires pg_trgm extension)
CREATE INDEX IF NOT EXISTS idx_seed_companies_name_zh_trgm ON seed_companies USING gin(name_zh gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seed_companies_name_en_trgm ON seed_companies USING gin(name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seed_companies_category     ON seed_companies(category) WHERE is_active = true;

COMMENT ON TABLE  seed_companies          IS 'Company search index: CN TOP500 + Fortune500 (C2 spec, ≥500 rows, server-side ilike search)';
COMMENT ON COLUMN seed_companies.category IS 'cn_top500 | fortune500 | tech | startup';

-- ── seed_schools ──────────────────────────────────────────────────────────────
-- School lookup: CN 985/211 (~115 schools) + QS Top 200.
-- UI uses server-side ilike search with 300ms debounce.
CREATE TABLE IF NOT EXISTS seed_schools (
  id          SERIAL       PRIMARY KEY,
  name_zh     TEXT         NOT NULL UNIQUE,
  name_en     TEXT         NOT NULL,
  category    TEXT         NOT NULL, -- 'cn_985' | 'cn_211' | 'qs_top200' | 'international'
  country     TEXT         NOT NULL DEFAULT 'CN',
  qs_rank     INTEGER,               -- QS world ranking (null for CN-only entries)
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seed_schools_name_zh_trgm ON seed_schools USING gin(name_zh gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seed_schools_name_en_trgm ON seed_schools USING gin(name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seed_schools_category     ON seed_schools(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seed_schools_country      ON seed_schools(country)  WHERE is_active = true;

COMMENT ON TABLE  seed_schools          IS 'School lookup: CN 985/211 + QS Top 200 (C2 spec, ≥300 rows, server-side ilike search)';
COMMENT ON COLUMN seed_schools.category IS 'cn_985 | cn_211 | qs_top200 | international';
COMMENT ON COLUMN seed_schools.qs_rank  IS 'QS World University Rankings position (null for entries not in QS list)';

-- ── RLS: seed tables are read-only public data ─────────────────────────────
-- No RLS needed — these are read-only reference tables, no user data.
-- API routes query them with the service role or anon key (SELECT only).

-- rollback:
-- DROP TABLE IF EXISTS seed_schools   CASCADE;
-- DROP TABLE IF EXISTS seed_companies CASCADE;
-- DROP TABLE IF EXISTS seed_skills    CASCADE;
-- DROP TABLE IF EXISTS seed_positions CASCADE;
