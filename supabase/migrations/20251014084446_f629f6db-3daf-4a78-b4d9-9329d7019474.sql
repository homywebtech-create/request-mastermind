-- Allow companies to view their own customers
CREATE POLICY "Companies can view their own customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id IS NOT NULL
      AND profiles.company_id = customers.company_id
  )
);