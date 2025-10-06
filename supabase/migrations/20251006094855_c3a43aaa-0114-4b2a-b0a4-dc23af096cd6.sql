-- Add booking_type and hours_count columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS booking_type TEXT,
ADD COLUMN IF NOT EXISTS hours_count TEXT;