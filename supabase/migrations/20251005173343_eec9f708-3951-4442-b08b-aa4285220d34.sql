-- Fix customers table policies
DROP POLICY IF EXISTS "Block anonymous access to customers" ON public.customers;

-- Recreate admin insert policy with simpler check
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);

-- Fix orders table policies
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
CREATE POLICY "Admins can insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);