-- ============================================
-- Migration: 20260330000001_initial_schema.sql
-- Description: Initial database schema - Core tables
-- Author: Claude
-- Created: 2026-03-30
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- Table 1: profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_market TEXT DEFAULT 'cn_free' CHECK (payment_market IN ('cn_free', 'en_paid')),
  signup_geo_country TEXT,
  resume_lang_preference TEXT DEFAULT 'zh',
  photo_path TEXT,
  photo_show_toggle BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_payment_market ON profiles(payment_market);
COMMENT ON TABLE profiles IS 'User profile with payment market settings';
COMMENT ON COLUMN profiles.payment_market IS 'Payment market: cn_free or en_paid';
COMMENT ON COLUMN profiles.signup_geo_country IS 'Geo country at signup (for UI defaults only)';

-- ============================================
-- Table 2: resume_uploads
-- ============================================
CREATE TABLE IF NOT EXISTS resume_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  photo_extracted TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_uploads_user_id ON resume_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_anonymous_id ON resume_uploads(anonymous_id);
COMMENT ON TABLE resume_uploads IS 'Resume file upload metadata';
COMMENT ON COLUMN resume_uploads.photo_extracted IS 'Extracted photo path if found';

-- ============================================
-- rollback
-- ============================================
-- DROP TABLE IF EXISTS resume_uploads;
-- DROP TABLE IF EXISTS profiles;
-- DROP EXTENSION IF EXISTS "vector";
-- DROP EXTENSION IF EXISTS "uuid-ossp";
