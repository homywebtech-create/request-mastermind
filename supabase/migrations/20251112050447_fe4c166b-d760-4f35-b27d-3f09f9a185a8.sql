-- Add waiting tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS waiting_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS waiting_ends_at timestamp with time zone;