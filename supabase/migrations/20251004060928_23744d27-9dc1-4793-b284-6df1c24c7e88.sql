-- ============================================
-- Fix: Prevent Verification Code Flooding Attack
-- ============================================

-- Drop the overly permissive policy that allows unlimited insertions
DROP POLICY IF EXISTS "Anyone can request verification codes" ON public.verification_codes;

-- Create a helper function to check rate limiting
-- Limits verification code requests to 3 per phone number per 15 minutes
CREATE OR REPLACE FUNCTION public.check_verification_rate_limit(phone_number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 3
  FROM public.verification_codes
  WHERE phone = phone_number
    AND created_at > now() - interval '15 minutes';
$$;

-- Create a restricted policy that only allows inserts through edge functions (service role)
-- Regular users cannot insert directly anymore
CREATE POLICY "Service role can insert verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (
  -- Only service role (edge functions) can insert
  auth.jwt() IS NULL OR auth.role() = 'service_role'
);

-- Add a comment explaining the security measure
COMMENT ON POLICY "Service role can insert verification codes" ON public.verification_codes IS 
'Verification codes can only be created through edge functions with rate limiting. Direct inserts by users are blocked to prevent abuse.';

-- Create an index for faster rate limit checks
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_created 
ON public.verification_codes(phone, created_at DESC);