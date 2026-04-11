-- Migration: 20260408000002_fix_handle_new_user_trigger.sql
-- Description: Fix handle_new_user trigger — was missing required payment_market and user_id fields,
--              causing "Database error saving new user" on Google OAuth / magic link signup.
-- Root cause: profiles table has payment_market NOT NULL and user_or_anonymous constraint,
--             but original trigger only inserted id + signup_geo_country.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, payment_market, signup_geo_country)
  VALUES (
    NEW.id,
    NEW.id,         -- user_id = auth.users.id (satisfies user_or_anonymous constraint)
    'cn_free',      -- default market; updated by frontend after locale/geo detection
    NEW.raw_user_meta_data->>'geo_country'
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: skip if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- rollback
-- (To revert: recreate the original broken trigger — intentionally omitted)
