-- Make verification code updates truly public for the verification process
DROP POLICY IF EXISTS "Allow verification code updates for valid codes" ON public.verification_codes;

CREATE POLICY "Public can verify valid codes"
ON public.verification_codes
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (
  verified = true 
  AND attempts < 10
);