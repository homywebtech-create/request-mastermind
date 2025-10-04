-- Temporarily increase rate limit for testing
DROP FUNCTION IF EXISTS public.check_verification_rate_limit(text);

CREATE FUNCTION public.check_verification_rate_limit(phone_number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 10  -- Increased from 3 to 10 for testing
  FROM public.verification_codes
  WHERE phone = phone_number
    AND created_at > now() - interval '15 minutes';
$$;