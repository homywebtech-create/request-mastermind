-- Create storage bucket for APK files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'apk-files',
  'apk-files',
  true,
  104857600, -- 100MB limit
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload APK files
CREATE POLICY "Admins can upload APK files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'apk-files' AND
  is_admin(auth.uid())
);

-- Allow admins to update APK files
CREATE POLICY "Admins can update APK files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'apk-files' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'apk-files' AND is_admin(auth.uid()));

-- Allow admins to delete APK files
CREATE POLICY "Admins can delete APK files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'apk-files' AND is_admin(auth.uid()));

-- Allow public read access to APK files (for downloads)
CREATE POLICY "Public can download APK files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'apk-files');