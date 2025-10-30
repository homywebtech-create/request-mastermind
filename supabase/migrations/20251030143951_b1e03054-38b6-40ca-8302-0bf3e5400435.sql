-- Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can upload specialist photos during registration" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload specialist photos" ON storage.objects;

-- Allow anyone to upload to specialist-photos during registration (no auth required)
CREATE POLICY "Allow public uploads to specialist-photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'specialist-photos');

-- id-cards already has "Anyone can upload to id-cards during registration" policy, which should work
-- but let's verify it's truly open (no auth check)
