-- Drop ALL existing INSERT policies on customers table
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all customer inserts" ON public.customers;

-- Create a single, permissive policy for INSERT that applies to everyone
CREATE POLICY "Public can insert customers without restrictions"
ON public.customers
FOR INSERT
TO public, authenticated, anon
WITH CHECK (true);

-- Also ensure UPDATE works for authenticated users
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Users can update customers"
ON public.customers
FOR UPDATE
TO authenticated, public
USING (true)
WITH CHECK (true);