-- Fix RLS to allow public anonymous verification
DROP POLICY IF EXISTS "Allow verification updates" ON public.verification_codes;

CREATE POLICY "Allow verification updates"
ON public.verification_codes
FOR UPDATE
TO public
USING (
  verified = false 
  AND expires_at > now()
)
WITH CHECK (
  verified = true
);