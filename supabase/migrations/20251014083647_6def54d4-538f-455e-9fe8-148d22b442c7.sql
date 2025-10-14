-- Drop the existing "Allow all inserts on customers" policy as it's not working correctly
DROP POLICY IF EXISTS "Allow all inserts on customers" ON public.customers;

-- Create new policy to allow companies to insert customers
CREATE POLICY "Companies can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id IS NOT NULL
      AND profiles.company_id = customers.company_id
  )
);

-- Create policy to allow admins to insert customers
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);