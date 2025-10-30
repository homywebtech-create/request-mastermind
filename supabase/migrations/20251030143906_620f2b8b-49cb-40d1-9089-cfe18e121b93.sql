-- Allow anonymous uploads to specialist-photos during registration
-- Drop existing policy if it exists to avoid duplicates
DROP POLICY IF EXISTS "Anyone can upload specialist photos during registration" ON storage.objects;

CREATE POLICY "Anyone can upload specialist photos during registration"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'specialist-photos'
  AND (
    name LIKE 'face/%' OR name LIKE 'full-body/%'
  )
);

-- Ensure public read access remains via bucket public flag (no additional SELECT policy needed here)
-- id-cards already has an open INSERT policy per existing configuration
