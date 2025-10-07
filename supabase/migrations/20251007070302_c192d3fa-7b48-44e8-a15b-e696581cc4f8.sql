-- Add English name field to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name_en TEXT;