-- Fix verification code update policy to work for anonymous users
DROP POLICY IF EXISTS "Public can verify valid codes" ON public.verification_codes;

CREATE POLICY "Allow verification updates"
ON public.verification_codes
FOR UPDATE
USING (
  verified = false 
  AND expires_at > now()
)
WITH CHECK (
  verified = true
);