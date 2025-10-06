-- Fix RLS policies for customers table to allow proper insertion

-- Drop existing insert policies
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Specialists can insert customers for their company" ON public.customers;

-- Create new simplified insert policies
-- Policy 1: Admins can insert any customer
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy 2: Non-admin users can insert customers for their company or without company
CREATE POLICY "Users can insert customers for their company"
ON public.customers
FOR INSERT
WITH CHECK (
  NOT has_role(auth.uid(), 'admin'::app_role)
  AND (
    customers.company_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = customers.company_id
    )
  )
);