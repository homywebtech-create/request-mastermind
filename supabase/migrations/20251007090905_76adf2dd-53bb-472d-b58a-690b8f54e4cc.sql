-- Allow public access to view order specialists with quotes for booking page
CREATE POLICY "Public can view order specialists with quotes"
ON public.order_specialists
FOR SELECT
USING (quoted_price IS NOT NULL);

-- Allow public access to view orders for booking page
CREATE POLICY "Public can view orders"
ON public.orders
FOR SELECT
USING (true);

-- Allow public access to update orders booking information
CREATE POLICY "Public can update order booking info"
ON public.orders
FOR UPDATE
USING (true)
WITH CHECK (true);