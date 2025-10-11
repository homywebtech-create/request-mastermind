-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow all customer inserts" ON public.customers;

-- Create a new permissive policy that allows anyone to insert customers
CREATE POLICY "Anyone can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (true);

-- Also ensure authenticated users can insert
CREATE POLICY "Authenticated users can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);