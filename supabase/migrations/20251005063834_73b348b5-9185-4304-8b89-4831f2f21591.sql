-- Add specialist_id column to orders table
ALTER TABLE public.orders
ADD COLUMN specialist_id uuid REFERENCES public.specialists(id);

-- Add index for better query performance
CREATE INDEX idx_orders_specialist_id ON public.orders(specialist_id);