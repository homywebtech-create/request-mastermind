-- Add payment tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_not_received_reason text,
ADD COLUMN IF NOT EXISTS final_amount numeric,
ADD COLUMN IF NOT EXISTS hourly_rate numeric;