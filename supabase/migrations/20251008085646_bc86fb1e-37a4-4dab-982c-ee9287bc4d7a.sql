-- Update tracking_stage constraint to include payment_received
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_tracking_stage_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_tracking_stage_check 
CHECK (tracking_stage IS NULL OR tracking_stage IN ('moving', 'arrived', 'working', 'completed', 'invoice_requested', 'cancelled', 'payment_received'));