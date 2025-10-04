-- ============================================
-- Fix: Restrict Verification Code Insertion to Service Role Only
-- ============================================
-- Problem: The INSERT policy currently allows unauthenticated users (auth.jwt() IS NULL)
-- to insert verification codes directly, bypassing the edge function security controls.
-- This could allow attackers to flood the system or create fake verification attempts.

-- Solution: Only allow the service_role to insert verification codes.
-- All code requests must go through the request-verification-code edge function
-- which enforces rate limiting and proper validation.

-- Drop the existing permissive insert policy
DROP POLICY IF EXISTS "Service role can insert verification codes" ON public.verification_codes;

-- Create a strict policy that ONLY allows service_role to insert
CREATE POLICY "Only service role can insert verification codes"
ON public.verification_codes
FOR INSERT
TO service_role
WITH CHECK (true);

-- Note: The UPDATE policy remains unchanged as it already has proper security checks:
-- - verified = false (can't update already verified codes)
-- - expires_at > now() (can't verify expired codes)
-- - attempts < 5 (rate limiting on verification attempts)
-- 
-- While users aren't authenticated during verification, the 6-digit code provides
-- sufficient security (1 in 1,000,000 chance per attempt, max 5 attempts = 0.0005% success rate)
-- combined with the 10-minute expiration window.

COMMENT ON POLICY "Only service role can insert verification codes" ON public.verification_codes IS
'Restricts verification code creation to the service role only. All verification requests must go through the request-verification-code edge function which enforces rate limiting (3 requests per 15 minutes per phone number) and proper validation.';