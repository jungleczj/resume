-- ============================================
-- Migration: 20260330000008_storage_and_triggers.sql
-- Description: Storage buckets and database triggers
-- Created: 2026-03-30
-- ============================================

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('resumes', 'resumes', false),
  ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resumes
CREATE POLICY "Users can upload own resume"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Users can view own resume"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

-- Storage policies for photos
CREATE POLICY "Users can upload own photo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Users can view own photo"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, signup_geo_country)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'geo_country'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- rollback
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DELETE FROM storage.buckets WHERE id IN ('resumes', 'photos');
