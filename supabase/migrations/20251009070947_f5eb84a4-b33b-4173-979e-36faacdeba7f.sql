-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Specialists can insert orders for their company" ON public.orders;

-- Recreate admin policy using has_role function
CREATE POLICY "Admins can insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Recreate specialist policy with proper logic
CREATE POLICY "Specialists can insert orders for their company"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Not an admin (admins have their own policy)
  NOT has_role(auth.uid(), 'admin'::app_role)
  AND
  -- User must have a profile
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid()
    AND (
      -- Either: order is for all companies (company_id can be anything)
      orders.send_to_all_companies = true
      OR
      -- Or: order is for user's specific company
      (profiles.company_id IS NOT NULL AND profiles.company_id = orders.company_id)
      OR
      -- Or: order has no specific company yet
      orders.company_id IS NULL
    )
  )
);