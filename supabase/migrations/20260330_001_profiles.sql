-- Migration: 001_profiles
-- Description: Create profiles table with payment market and photo fields
-- Created: 2026-03-30

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id UUID UNIQUE,
  payment_market TEXT NOT NULL CHECK (payment_market IN ('cn_free', 'en_paid')),
  signup_geo_country TEXT,
  resume_lang_preference TEXT DEFAULT 'zh' CHECK (resume_lang_preference IN ('zh', 'en')),
  photo_path TEXT,
  photo_show_toggle BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_or_anonymous CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL) OR
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_anonymous_id ON profiles(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_profiles_payment_market ON profiles(payment_market);

-- Add comments
COMMENT ON TABLE profiles IS 'User profiles with payment market and preferences';
COMMENT ON COLUMN profiles.payment_market IS 'Payment market: cn_free or en_paid';
COMMENT ON COLUMN profiles.photo_path IS 'Storage path for user photo';
COMMENT ON COLUMN profiles.photo_show_toggle IS 'Whether to show photo in resume';

-- rollback
-- DROP TABLE IF EXISTS profiles CASCADE;
