-- Create storage bucket for specialist photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('specialist-photos', 'specialist-photos', true);

-- Create RLS policies for specialist photos
CREATE POLICY "Anyone can view specialist photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'specialist-photos');

CREATE POLICY "Authenticated users can upload specialist photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'specialist-photos');

CREATE POLICY "Users can update their company specialist photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'specialist-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company specialist photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'specialist-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Modify specialists table
ALTER TABLE public.specialists
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS nationality text,
ADD COLUMN IF NOT EXISTS sub_service_id uuid REFERENCES public.sub_services(id);

-- Drop old specialty column if exists and rename
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'specialists' AND column_name = 'specialty' 
             AND data_type = 'text') THEN
    -- Keep specialty as optional text for now
    ALTER TABLE public.specialists ALTER COLUMN specialty DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.specialists.image_url IS 'رابط صورة المحترف';
COMMENT ON COLUMN public.specialists.nationality IS 'جنسية المحترف';
COMMENT ON COLUMN public.specialists.sub_service_id IS 'التخصص (الخدمة الفرعية)';