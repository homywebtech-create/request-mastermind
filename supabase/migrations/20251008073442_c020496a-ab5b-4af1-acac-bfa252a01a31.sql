-- Fix the generate_order_number function to avoid ambiguous column reference
DROP FUNCTION IF EXISTS public.generate_order_number() CASCADE;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  generated_order_number TEXT;
BEGIN
  -- Get the highest existing order number
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number IS NOT NULL;
  
  -- Format as ORD-0001, ORD-0002, etc.
  generated_order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN generated_order_number;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;

CREATE TRIGGER set_order_number_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();