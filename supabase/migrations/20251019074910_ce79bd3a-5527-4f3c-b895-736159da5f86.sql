-- Drop the blocking policy for anonymous access
DROP POLICY IF EXISTS "Block anonymous access to companies" ON public.companies;

-- Update the public viewing policy to be more permissive for booking page
DROP POLICY IF EXISTS "Anyone can view active company basic info for authentication" ON public.companies;

CREATE POLICY "Public can view active companies for booking"
ON public.companies
FOR SELECT
USING (is_active = true);