-- Fix customers table RLS policies to allow proper access

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;

-- Create new policies that properly allow authenticated users to manage customers
CREATE POLICY "Authenticated users can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update any customer"
ON public.customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);