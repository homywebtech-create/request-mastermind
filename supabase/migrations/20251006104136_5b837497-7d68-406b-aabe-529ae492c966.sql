-- Drop all existing INSERT policies for customers
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Specialists can insert customers for their company" ON public.customers;

-- Create a simple permissive INSERT policy that allows any authenticated user
CREATE POLICY "Allow authenticated users to insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);