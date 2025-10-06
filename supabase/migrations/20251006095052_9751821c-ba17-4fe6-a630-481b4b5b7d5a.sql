-- Add budget_type column to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS budget_type TEXT;