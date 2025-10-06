-- Fix RLS policies for customers table - complete cleanup and recreation

-- Drop all existing insert policies
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Specialists can insert customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers for their company" ON public.customers;

-- Create new simplified insert policy that works for both admins and regular users
CREATE POLICY "Allow insert customers with proper access"
ON public.customers
FOR INSERT
WITH CHECK (
  -- Admins can insert any customer
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Non-admin users can insert customers without company_id OR for their own company
  (
    NOT has_role(auth.uid(), 'admin'::app_role)
    AND (
      customers.company_id IS NULL 
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.company_id = customers.company_id
      )
    )
  )
);