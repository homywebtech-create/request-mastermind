-- Update the INSERT policy to allow any authenticated user to insert customers without restrictions
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

CREATE POLICY "Authenticated users can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Update the UPDATE policy to ensure it allows all updates
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;

CREATE POLICY "Authenticated users can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);