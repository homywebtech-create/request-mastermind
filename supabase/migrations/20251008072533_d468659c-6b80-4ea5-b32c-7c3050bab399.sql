-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- Create a correct INSERT policy that explicitly checks authentication
CREATE POLICY "Authenticated users can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);