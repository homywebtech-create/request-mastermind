-- Grant explicit UPDATE permission to anon role
GRANT UPDATE ON public.verification_codes TO anon;
GRANT UPDATE ON public.verification_codes TO authenticated;

-- Recreate the policy with proper permissions
DROP POLICY IF EXISTS "Allow verification updates" ON public.verification_codes;

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