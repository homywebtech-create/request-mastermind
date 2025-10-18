-- Fix RLS policy for customers table to allow admin insertions without company_id
-- Drop the existing admin insert policy
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;

-- Create a new policy that properly allows admins to insert customers
CREATE POLICY "Admins can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'admin_full'::app_role) 
  OR has_role(auth.uid(), 'admin_manager'::app_role)
);

-- Update the company insert policy to handle NULL company_id for send-to-all cases
DROP POLICY IF EXISTS "Companies can insert customers" ON public.customers;

CREATE POLICY "Companies can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
      AND profiles.company_id IS NOT NULL 
      AND (
        profiles.company_id = customers.company_id 
        OR customers.company_id IS NULL
      )
  )
);