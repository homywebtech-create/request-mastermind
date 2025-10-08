-- Add order_number column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number text;

-- Create a function to generate sequential order numbers
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

-- Update existing orders without order numbers using CTE
WITH numbered_orders AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders
SET order_number = 'ORD-' || LPAD(numbered_orders.rn::TEXT, 4, '0')
FROM numbered_orders
WHERE public.orders.id = numbered_orders.id;