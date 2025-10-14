-- Fix function search path for security
DROP FUNCTION IF EXISTS public.generate_specialist_registration_token();

CREATE OR REPLACE FUNCTION public.generate_specialist_registration_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;