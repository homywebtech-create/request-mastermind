-- Allow public/anonymous users to view orders for booking purposes
CREATE POLICY "Public can view orders for booking"
ON public.orders
FOR SELECT
USING (true);