-- Allow anyone to check if a specialist exists and is active for authentication
CREATE POLICY "Anyone can verify active specialists for authentication"
ON public.specialists
FOR SELECT
TO anon, authenticated
USING (is_active = true);