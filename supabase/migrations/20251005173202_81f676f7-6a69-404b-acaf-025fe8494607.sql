-- Drop existing insert policies for customers
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Specialists can insert customers for their company" ON public.customers;

-- Create new insert policy for admins (allows any company_id including NULL)
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Keep specialist insert policy
CREATE POLICY "Specialists can insert customers for their company"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.company_id = customers.company_id OR customers.company_id IS NULL)
  )
  AND NOT has_role(auth.uid(), 'admin'::app_role)
);