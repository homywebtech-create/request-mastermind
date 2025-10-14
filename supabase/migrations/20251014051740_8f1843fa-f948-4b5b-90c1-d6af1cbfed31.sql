-- Add approval status and registration token to specialists table
ALTER TABLE public.specialists 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS registration_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS registration_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_specialists_registration_token ON public.specialists(registration_token);

-- Function to generate registration token
CREATE OR REPLACE FUNCTION public.generate_specialist_registration_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

-- Update RLS policies to allow specialists to complete their own registration
CREATE POLICY "Allow public access to specialists with valid registration token"
ON public.specialists
FOR SELECT
TO anon
USING (registration_token IS NOT NULL AND approval_status = 'pending');

CREATE POLICY "Allow specialists to update their own profile with registration token"
ON public.specialists
FOR UPDATE
TO anon
USING (registration_token IS NOT NULL AND approval_status = 'pending')
WITH CHECK (registration_token IS NOT NULL AND approval_status = 'pending');