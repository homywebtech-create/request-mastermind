-- Fix RLS policy to allow creating customers with any phone number

DROP POLICY IF EXISTS "Allow insert customers with proper access" ON public.customers;

-- Create simpler policy that allows authenticated users to insert customers
CREATE POLICY "Authenticated users can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);