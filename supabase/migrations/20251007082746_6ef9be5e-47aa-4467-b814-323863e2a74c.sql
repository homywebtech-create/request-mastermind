-- Drop existing insert policy that may be causing issues
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- Create a more permissive insert policy for customers
CREATE POLICY "Anyone authenticated can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure update policy allows authenticated users to update
DROP POLICY IF EXISTS "Authenticated users can update any customer" ON public.customers;

CREATE POLICY "Authenticated users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);