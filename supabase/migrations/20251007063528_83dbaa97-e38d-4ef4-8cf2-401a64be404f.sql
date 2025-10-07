-- Delete test companies (keeping only النميلة company)
DELETE FROM company_services 
WHERE company_id IN (
  '2f35418a-71a4-4f05-9b92-0d553a072b28',
  'ff6bec2c-60cc-447d-9ff0-a22326214b00',
  '54e3188e-6c3e-49a8-8136-c0527b4337b7',
  'be377e05-f672-4b2d-a59f-ab85d6cf7205',
  'ace67bdc-2e77-4f08-84e5-962f2dcaaa55'
);

DELETE FROM specialists 
WHERE company_id IN (
  '2f35418a-71a4-4f05-9b92-0d553a072b28',
  'ff6bec2c-60cc-447d-9ff0-a22326214b00',
  '54e3188e-6c3e-49a8-8136-c0527b4337b7',
  'be377e05-f672-4b2d-a59f-ab85d6cf7205',
  'ace67bdc-2e77-4f08-84e5-962f2dcaaa55'
);

DELETE FROM companies 
WHERE id IN (
  '2f35418a-71a4-4f05-9b92-0d553a072b28',
  'ff6bec2c-60cc-447d-9ff0-a22326214b00',
  '54e3188e-6c3e-49a8-8136-c0527b4337b7',
  'be377e05-f672-4b2d-a59f-ab85d6cf7205',
  'ace67bdc-2e77-4f08-84e5-962f2dcaaa55'
);

-- Add logo_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for company logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

-- Allow authenticated users to upload company logos
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- Allow everyone to view company logos
CREATE POLICY "Everyone can view company logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated users to update company logos
CREATE POLICY "Authenticated users can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

-- Allow authenticated users to delete company logos
CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');