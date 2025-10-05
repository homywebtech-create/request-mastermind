-- Add last_sent_at column to track when order was last sent/resent
ALTER TABLE public.orders 
ADD COLUMN last_sent_at TIMESTAMP WITH TIME ZONE;

-- Set last_sent_at to created_at for existing orders that have been sent
UPDATE public.orders 
SET last_sent_at = created_at 
WHERE company_id IS NOT NULL OR send_to_all_companies = true;