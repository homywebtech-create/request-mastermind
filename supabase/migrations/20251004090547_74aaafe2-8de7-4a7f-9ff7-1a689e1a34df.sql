-- Fix RLS policy for verification_codes to allow anonymous verification
DROP POLICY IF EXISTS "Users can mark codes as verified during verification" ON public.verification_codes;

CREATE POLICY "Allow verification code updates for valid codes"
ON public.verification_codes
FOR UPDATE
TO anon, authenticated
USING (
  verified = false 
  AND expires_at > now() 
  AND attempts < 5
)
WITH CHECK (
  verified = true
);

-- Fix RLS policy for profiles to allow immediate post-signup updates
DROP POLICY IF EXISTS "Users can update their own profile safely" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());