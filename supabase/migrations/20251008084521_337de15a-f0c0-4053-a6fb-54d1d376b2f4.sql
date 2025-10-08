-- Add tracking_stage column to orders table to track specialist progress
ALTER TABLE public.orders 
ADD COLUMN tracking_stage text NULL DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.orders.tracking_stage IS 'Tracks the current stage of specialist: moving, arrived, working, completed, invoice_requested';

-- Add check constraint to ensure valid stages
ALTER TABLE public.orders
ADD CONSTRAINT orders_tracking_stage_check 
CHECK (tracking_stage IS NULL OR tracking_stage IN ('moving', 'arrived', 'working', 'completed', 'invoice_requested', 'cancelled'));