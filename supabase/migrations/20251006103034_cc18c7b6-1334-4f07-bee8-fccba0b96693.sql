-- Add UPDATE policy for customers table

CREATE POLICY "Authenticated users can update customers"
ON public.customers
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);