-- ============================================
-- Migration: 20260406000002_make_photos_public.sql
-- Description: Make photos bucket public for resume photo extraction
-- Created: 2026-04-06
-- ============================================

-- Update photos bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'photos';

-- Add public read policy for photos
DROP POLICY IF EXISTS "Users can view own photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- rollback
-- UPDATE storage.buckets SET public = false WHERE id = 'photos';
-- DROP POLICY "Anyone can view photos" ON storage.objects;
-- CREATE POLICY "Users can view own photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
