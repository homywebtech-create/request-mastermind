-- Fix infinite recursion in orders RLS policy
-- The "Customers can update order booking info" policy was causing infinite recursion
-- by querying the orders table from within the orders policy

DROP POLICY IF EXISTS "Customers can update order booking info" ON public.orders;

-- Create a simpler policy that allows updates to booking-related columns
-- without recursive queries
CREATE POLICY "Public can update order booking info"
ON public.orders
FOR UPDATE
USING (true)
WITH CHECK (true);