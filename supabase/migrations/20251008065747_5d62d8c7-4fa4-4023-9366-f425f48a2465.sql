-- Add booking_time column to orders table to store the selected time slot
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS booking_time text;