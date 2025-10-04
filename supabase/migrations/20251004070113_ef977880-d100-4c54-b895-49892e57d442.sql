-- Add send_to_all_companies field to orders table
-- This allows orders to be sent to all companies that offer the selected service

ALTER TABLE public.orders 
ADD COLUMN send_to_all_companies boolean DEFAULT false NOT NULL;

-- Make company_id nullable to support sending to all companies
ALTER TABLE public.orders 
ALTER COLUMN company_id DROP NOT NULL;

-- Add a check constraint to ensure either company_id is set OR send_to_all_companies is true
ALTER TABLE public.orders
ADD CONSTRAINT orders_company_selection_check 
CHECK (
  (company_id IS NOT NULL AND send_to_all_companies = false) OR
  (company_id IS NULL AND send_to_all_companies = true)
);

COMMENT ON COLUMN public.orders.send_to_all_companies IS 
'When true, the order is sent to all companies that offer the selected service. When false, the order is sent only to the specified company_id.';

-- Update RLS policies to handle null company_id for send_to_all_companies orders
-- Specialists can view orders sent to all companies OR orders for their specific company
DROP POLICY IF EXISTS "Specialists can view their company orders" ON public.orders;
CREATE POLICY "Specialists can view their company orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND (
      profiles.company_id = orders.company_id 
      OR orders.send_to_all_companies = true
    )
  )
);

-- Specialists can update orders for their company OR orders sent to all companies
DROP POLICY IF EXISTS "Specialists can update their company orders" ON public.orders;
CREATE POLICY "Specialists can update their company orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND (
      profiles.company_id = orders.company_id 
      OR orders.send_to_all_companies = true
    )
  )
);