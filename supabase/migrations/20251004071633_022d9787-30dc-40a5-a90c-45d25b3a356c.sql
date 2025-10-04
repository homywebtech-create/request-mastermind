-- Fix customers RLS policies to allow admins to create customers without company_id
-- This is needed when creating orders that are sent to all companies

-- Drop the existing admin insert policy
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;

-- Create a new admin insert policy that doesn't require company_id
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also update the specialist policy to handle null company_id for send_to_all_companies orders
DROP POLICY IF EXISTS "Specialists can insert customers for their company" ON public.customers;

CREATE POLICY "Specialists can insert customers for their company"
ON public.customers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND (
      profiles.company_id = customers.company_id 
      OR customers.company_id IS NULL
    )
  )
);

COMMENT ON POLICY "Admins can insert customers" ON public.customers IS
'Allows admins to create customers for any company or without a company (for orders sent to all companies)';

COMMENT ON POLICY "Specialists can insert customers for their company" ON public.customers IS
'Allows specialists to create customers for their company or without a company (for orders sent to all companies)';