-- Drop the restrictive policy and create a new one that allows specialists to view customers of their assigned orders
DROP POLICY IF EXISTS "Specialists can view their company customers" ON public.customers;

-- Create a new policy that allows specialists to view customers of orders assigned to them
CREATE POLICY "Specialists can view customers of their assigned orders"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    INNER JOIN order_specialists os ON os.order_id = o.id
    INNER JOIN specialists s ON s.id = os.specialist_id
    INNER JOIN profiles p ON p.phone = s.phone
    WHERE o.customer_id = customers.id
      AND p.user_id = auth.uid()
  )
);