-- Adjust SELECT policy to allow all admin roles to view customers (including returning rows after insert)
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;

CREATE POLICY "Admins can view all customers"
ON public.customers
FOR SELECT
USING (is_admin(auth.uid()));