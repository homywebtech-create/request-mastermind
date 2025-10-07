-- Fix customers RLS policies to prevent insert errors
-- Drop all existing policies first
DROP POLICY IF EXISTS "Anyone authenticated can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update any customer" ON public.customers;

-- Create new PERMISSIVE insert policy that allows authenticated users to insert
CREATE POLICY "Authenticated users can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create PERMISSIVE update policy
CREATE POLICY "Authenticated users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);