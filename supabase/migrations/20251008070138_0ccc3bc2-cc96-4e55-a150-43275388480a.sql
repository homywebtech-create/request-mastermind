-- Fix search_path for order number functions
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  -- Get the highest existing order number
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders
  WHERE order_number IS NOT NULL;
  
  -- Format as ORD-0001, ORD-0002, etc.
  order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;